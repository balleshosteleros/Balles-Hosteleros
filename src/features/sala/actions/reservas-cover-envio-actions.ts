"use server";

/**
 * Envío puntual de la confirmación a las reservas que se migraron de
 * CoverManager (volcado del 3-sep-2026).
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 * CoverManager y Balles nunca estuvieron conectados: la migración fue una FOTO.
 * Las reservas anteriores al corte viven aquí, pero el cliente solo tiene el
 * correo viejo de Cover, con el enlace de cancelación de Cover. Si cancela por
 * ahí no nos enteramos y la mesa se queda muerta (le pasó a una reserva del
 * 4-sep).
 *
 * Mandarles la confirmación de Balles les da un enlace de cancelación NUESTRO:
 * a partir de ahí, cancelar significa que la mesa se libera de verdad.
 *
 * Es una operación de UNA VEZ. Cuando se consuma la última de esas reservas
 * (27-oct-2026) este archivo se borra: no es una función del producto.
 */

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { enviarReservaEmail } from "@/lib/email/reservas/mailer";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Fecha del volcado: lo anterior a esto vino de CoverManager. */
const ORIGEN_MIGRACION = "covermanager";

export interface ReservaCoverPendiente {
  id: string;
  cliente: string;
  email: string;
  fecha: string;
  hora: string;
  personas: number;
  mesa: string | null;
  estado: string;
  /** Ya se le mandó la confirmación de Balles en un envío anterior. */
  yaEnviado: boolean;
}

async function getCtx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(
    supabase as unknown as SupabaseClient,
    user.id,
  );
  return { supabase, empresaId };
}

/**
 * Reservas migradas de Cover que siguen en pie y aún están por venir.
 *
 * Se excluyen:
 *   · CANCELADA / NO_SHOW  → no van a venir, no hay nada que confirmar.
 *   · SENTADA / TERMINANDO → ya están en la mesa; confirmarle la reserva a
 *     quien está comiendo no tiene sentido.
 *   · sin correo           → no hay a dónde mandarlo; esas se resuelven por
 *     teléfono.
 */
export async function listarReservasCoverPendientes(): Promise<{
  ok: boolean;
  data: ReservaCoverPendiente[];
  error?: string;
}> {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, data: [], error: "Sin empresa activa." };

    const hoy = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("reservas")
      .select(
        "id, cliente_nombre, cliente_apellidos, cliente_email, fecha, hora, personas, mesa, estado, email_confirmacion_at",
      )
      .eq("empresa_id", empresaId)
      .eq("external_origen", ORIGEN_MIGRACION)
      .gte("fecha", hoy)
      .not("estado", "in", "(CANCELADA,NO_SHOW,SENTADA,TERMINANDO)")
      .not("cliente_email", "is", null)
      .order("fecha", { ascending: true })
      .order("hora", { ascending: true });
    if (error) throw error;

    const filas: ReservaCoverPendiente[] = (data ?? [])
      .filter((r) => String(r.cliente_email ?? "").trim() !== "")
      .map((r) => ({
        id: r.id as string,
        cliente: `${r.cliente_nombre ?? ""} ${r.cliente_apellidos ?? ""}`.trim(),
        email: r.cliente_email as string,
        fecha: r.fecha as string,
        hora: String(r.hora ?? "").slice(0, 5),
        personas: (r.personas as number) ?? 0,
        mesa: (r.mesa as string) ?? null,
        estado: r.estado as string,
        yaEnviado: r.email_confirmacion_at != null,
      }));

    return { ok: true, data: filas };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reservas-cover] listar:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export interface ResultadoEnvioCover {
  id: string;
  cliente: string;
  email: string;
  ok: boolean;
  error?: string;
}

/**
 * Manda la confirmación a las reservas indicadas.
 *
 * Se envía UNA a UNA a propósito: si una falla (correo inexistente, rebote), el
 * resto sale igual y el resultado dice exactamente cuál falló, para llamar solo
 * a esa. Un envío en bloque que se cae a la mitad dejaría sin saber quién ha
 * recibido qué.
 *
 * No reenvía a quien ya tiene `email_confirmacion_at`: pulsar dos veces el
 * botón no le manda el correo dos veces al cliente.
 */
export async function enviarConfirmacionesCover(ids: string[]): Promise<{
  ok: boolean;
  resultados: ResultadoEnvioCover[];
  error?: string;
}> {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId)
      return { ok: false, resultados: [], error: "Sin empresa activa." };
    if (!Array.isArray(ids) || ids.length === 0)
      return { ok: false, resultados: [], error: "No hay reservas que enviar." };

    // Se releen de BD acotando por empresa activa: la RLS no distingue cuál de
    // las empresas del usuario está abierta, así que sin este filtro se podría
    // escribir sobre reservas de la otra.
    const { data, error } = await supabase
      .from("reservas")
      .select(
        "id, cliente_nombre, cliente_apellidos, cliente_email, estado, email_confirmacion_at",
      )
      .eq("empresa_id", empresaId)
      .eq("external_origen", ORIGEN_MIGRACION)
      .in("id", ids);
    if (error) throw error;

    const resultados: ResultadoEnvioCover[] = [];
    for (const r of data ?? []) {
      const cliente = `${r.cliente_nombre ?? ""} ${r.cliente_apellidos ?? ""}`.trim();
      const email = String(r.cliente_email ?? "").trim();

      if (!email) {
        resultados.push({
          id: r.id as string,
          cliente,
          email: "",
          ok: false,
          error: "La reserva no tiene correo: hay que avisar por teléfono.",
        });
        continue;
      }
      if (r.email_confirmacion_at != null) {
        resultados.push({
          id: r.id as string,
          cliente,
          email,
          ok: true,
          error: "Ya se le había enviado: no se reenvía.",
        });
        continue;
      }

      const res = await enviarReservaEmail(r.id as string, "CONFIRMADA", {
        actor: { origen: "MANUAL" },
      });
      resultados.push({
        id: r.id as string,
        cliente,
        email,
        ok: res.ok,
        error: res.ok ? undefined : (res.error ?? "No se pudo enviar."),
      });
    }

    return { ok: resultados.some((x) => x.ok), resultados };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reservas-cover] enviar:", msg);
    return { ok: false, resultados: [], error: msg };
  }
}
