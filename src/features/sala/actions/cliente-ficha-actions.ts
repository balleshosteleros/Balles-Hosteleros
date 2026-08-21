"use server";

/**
 * Guardado de la FICHA de cliente de sala.
 *
 * POR QUÉ no vale el `updateCliente` genérico: los datos de contacto viven
 * duplicados en cada reserva (`reservas.cliente_nombre`, `cliente_telefono`…)
 * además de en la ficha. Si al corregir un teléfono solo se tocara la ficha, el
 * mismo cliente tendría dos números distintos según dónde se le mire y el
 * correo o la llamada saldrían al viejo. Un cliente, un dato.
 *
 * Es la operación simétrica de `guardarDatosClienteReserva()` (que edita desde
 * la reserva); esta edita desde la ficha y propaga hacia las reservas.
 */

import { createClient } from "@/lib/supabase/server";
import {
  getEmpresaActivaForUser,
  getZonaHorariaEmpresa,
} from "@/features/empresa/lib/empresa-server";
import { ahoraEnZona } from "@/features/empresa/lib/zona-horaria";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const CLASIFICACIONES = [
  "REGULAR",
  "VIP",
  "FRECUENTE",
  "NUEVO",
  "INACTIVO",
] as const;

const Schema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(120),
  apellidos: z.string().trim().max(120).default(""),
  telefono: z.string().trim().max(40).default(""),
  email: z
    .string()
    .trim()
    .max(160)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, {
      message: "El email no es válido.",
    })
    .default(""),
  clasificacion: z.enum(CLASIFICACIONES),
  /**
   * true = el usuario fija la clasificación a mano. false = vuelve a calcularse
   * sola por visitas.
   */
  clasificacionManual: z.boolean(),
  observaciones: z.string().trim().max(2000).default(""),
  preferencias: z.string().trim().max(2000).default(""),
  notasInternas: z.string().trim().max(2000).default(""),
});

export type GuardarFichaClienteInput = z.input<typeof Schema>;

/** Normalización ES de teléfono, igual que la que aplica `clientes_sala`. */
function normalizarTelefono(tel: string): string | null {
  const soloDigitos = tel.replace(/\D/g, "");
  if (!soloDigitos) return null;
  if (/^0034[6-9]\d{8}$/.test(soloDigitos)) return soloDigitos.slice(4);
  if (/^34[6-9]\d{8}$/.test(soloDigitos)) return soloDigitos.slice(2);
  return soloDigitos;
}

export async function guardarFichaCliente(
  clienteId: string,
  input: GuardarFichaClienteInput,
): Promise<{ ok: boolean; error?: string; existingId?: string }> {
  try {
    const parsed = Schema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
      };
    }
    const d = parsed.data;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "No autenticado." };
    const empresaId = await getEmpresaActivaForUser(
      supabase as unknown as SupabaseClient,
      user.id,
    );
    if (!empresaId) return { ok: false, error: "Sin empresa activa." };

    const nombre = d.nombre;
    const apellidos = d.apellidos || null;
    const email = d.email || null;
    const telefono = d.telefono || null;

    // La ficha tiene que seguir siendo única por contacto: si el email o el
    // teléfono ya están en OTRA ficha, se aborta en vez de crear un duplicado
    // silencioso que rompería el histórico del cliente.
    const emailN = email ? email.toLowerCase() : null;
    const telN = telefono ? normalizarTelefono(telefono) : null;
    if (emailN || telN) {
      const filtros: string[] = [];
      if (emailN) filtros.push(`email_normalizado.eq.${emailN}`);
      if (telN) filtros.push(`telefono_normalizado.eq.${telN}`);
      const { data: choque } = await supabase
        .from("clientes_sala")
        .select("id")
        .eq("empresa_id", empresaId)
        .neq("id", clienteId)
        .or(filtros.join(","))
        .limit(1)
        .maybeSingle();
      if (choque?.id) {
        return {
          ok: false,
          error: "Ese email o teléfono ya está en otra ficha de cliente.",
          existingId: choque.id as string,
        };
      }
    }

    // 1) La ficha manda: se actualiza primero. Las columnas `*_normalizado` son
    //    generadas, se recalculan solas.
    const { error: errFicha } = await supabase
      .from("clientes_sala")
      .update({
        nombre,
        apellidos,
        email,
        telefono,
        clasificacion: d.clasificacion,
        clasificacion_manual: d.clasificacionManual,
        observaciones: d.observaciones || null,
        preferencias: d.preferencias || null,
        notas_internas: d.notasInternas || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clienteId)
      .eq("empresa_id", empresaId);
    if (errFicha) throw errFicha;

    // 2) Propagación a las reservas que llevan copia de estos datos. Solo las de
    //    ESTE cliente en ESTA empresa.
    const { error: errRes } = await supabase
      .from("reservas")
      .update({
        cliente_nombre: nombre,
        cliente_apellidos: apellidos,
        cliente_email: email,
        cliente_telefono: telefono,
        updated_at: new Date().toISOString(),
      })
      .eq("cliente_id", clienteId)
      .eq("empresa_id", empresaId);
    if (errRes) throw errRes;

    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[clientes] guardarFichaCliente:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Recalcula `visitas` de un cliente a partir de sus reservas realmente
 * cumplidas, y actualiza `ultima_visita`.
 *
 * POR QUÉ hace falta: `visitas` se incrementaba a mano (`incrementarVisita`) y
 * en fichas creadas desde el portal se quedaba a 0 aunque el cliente ya hubiera
 * venido. Como la clasificación ahora depende de las visitas, el contador tiene
 * que reflejar la realidad y no el histórico de quién se acordó de pulsar.
 */
export async function recalcularVisitasCliente(
  clienteId: string,
): Promise<{ ok: boolean; visitas?: number; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "No autenticado." };
    const empresaId = await getEmpresaActivaForUser(
      supabase as unknown as SupabaseClient,
      user.id,
    );
    if (!empresaId) return { ok: false, error: "Sin empresa activa." };

    // El corte "hasta hoy" se calcula en la zona de la EMPRESA. Con la del
    // servidor (UTC en producción), al cerrar de madrugada `toISOString()`
    // devolvería el día anterior y la visita de esa misma noche no se contaría.
    const tz = await getZonaHorariaEmpresa(
      supabase as unknown as SupabaseClient,
      empresaId,
    );
    const { fecha: hoy } = ahoraEnZona(tz);

    // Una visita es una reserva que se sentó. Los estados excluidos son los
    // mismos que en la lista de próximas reservas, para que ambas pantallas
    // cuenten igual.
    const { data, error } = await supabase
      .from("reservas")
      .select("fecha")
      .eq("empresa_id", empresaId)
      .eq("cliente_id", clienteId)
      .not("estado", "in", "(CANCELADA,NO_SHOW,LIBERADA,LISTA_ESPERA)")
      .lte("fecha", hoy)
      .order("fecha", { ascending: false });
    if (error) throw error;

    const visitas = (data ?? []).length;
    const ultima = (data ?? [])[0]?.fecha as string | undefined;

    const { error: errUpd } = await supabase
      .from("clientes_sala")
      .update({
        visitas,
        ultima_visita: ultima ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clienteId)
      .eq("empresa_id", empresaId);
    if (errUpd) throw errUpd;

    return { ok: true, visitas };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[clientes] recalcularVisitasCliente:", msg);
    return { ok: false, error: msg };
  }
}
