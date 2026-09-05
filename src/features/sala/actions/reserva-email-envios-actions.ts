"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReservaEmailTipo } from "@/lib/seeds/reserva-email-plantillas";

/**
 * Una línea del histórico de correos de una reserva: qué salió, cuándo, a quién
 * y de la mano de quién.
 */
export interface ReservaEmailEnvio {
  id: string;
  /** Tipo del correo que salió. Fuente única: el seed de plantillas. */
  tipo: ReservaEmailTipo;
  destinatario: string | null;
  asunto: string | null;
  /** Nombre de la persona que lo envió. Null si no hubo persona detrás. */
  usuarioNombre: string | null;
  origen: "MANUAL" | "AUTOMATICO" | "PORTAL_PUBLICO" | "GOOGLE_RWG";
  enviadoAt: string;
  /**
   * Cuándo se abrió por primera vez, o null si no consta.
   *
   * Lo marca el píxel del correo. Que conste es señal fiable de que el correo
   * LLEGÓ a un buzón real; que no conste no prueba lo contrario, porque
   * Outlook y quien bloquea imágenes leen sin cargarlo.
   */
  abiertoAt: string | null;
}

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
  return { supabase, user, empresaId };
}

/**
 * Histórico de correos realmente enviados de una reserva, del más reciente al
 * más antiguo. Solo lectura: el histórico lo escribe el mailer y nadie más.
 */
export async function listReservaEmailEnvios(reservaId: string) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, data: [] as ReservaEmailEnvio[] };

    // El filtro por empresa va explícito: la RLS acota a las empresas DEL
    // usuario, no a la ACTIVA (mismo motivo que en el resto de reservas).
    const { data, error } = await supabase
      .from("reserva_email_envios")
      .select(
        "id, tipo, destinatario, asunto, usuario_nombre, origen, enviado_at, abierto_at",
      )
      .eq("reserva_id", reservaId)
      .eq("empresa_id", empresaId)
      .order("enviado_at", { ascending: false });
    if (error) throw error;

    const envios: ReservaEmailEnvio[] = (data ?? []).map((row) => ({
      id: row.id as string,
      tipo: row.tipo as ReservaEmailEnvio["tipo"],
      destinatario: (row.destinatario as string | null) ?? null,
      asunto: (row.asunto as string | null) ?? null,
      usuarioNombre: (row.usuario_nombre as string | null) ?? null,
      origen: row.origen as ReservaEmailEnvio["origen"],
      enviadoAt: row.enviado_at as string,
      abiertoAt: (row.abierto_at as string | null) ?? null,
    }));
    return { ok: true, data: envios };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reservas] listReservaEmailEnvios:", msg);
    return { ok: false, data: [] as ReservaEmailEnvio[] };
  }
}

/**
 * El correo tal cual lo recibió el cliente, para verlo desde la ficha.
 *
 * Se devuelve el HTML guardado en el envío, no uno regenerado: la plantilla y
 * los datos de la reserva cambian con el tiempo, y lo que interesa comprobar
 * es lo que el cliente tuvo delante.
 *
 * El píxel de seguimiento se quita antes de devolverlo: abrirlo desde la ficha
 * contaría como una apertura del cliente y el dato dejaría de valer.
 */
export async function getReservaEmailCuerpo(envioId: string) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, html: null as string | null };

    const { data, error } = await supabase
      .from("reserva_email_envios")
      .select("cuerpo_html, asunto, destinatario, enviado_at")
      .eq("id", envioId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, html: null as string | null };

    const guardado = (data.cuerpo_html as string | null) ?? null;
    // Los correos enviados antes de guardar el cuerpo no tienen nada que
    // enseñar: se distingue del error para poder decirlo en pantalla.
    if (!guardado) {
      return {
        ok: true,
        html: null as string | null,
        asunto: (data.asunto as string | null) ?? null,
        destinatario: (data.destinatario as string | null) ?? null,
        sinCuerpo: true,
      };
    }

    const html = guardado.replace(
      /<img[^>]*\/api\/email\/abierto\/[^>]*>/gi,
      "",
    );
    return {
      ok: true,
      html,
      asunto: (data.asunto as string | null) ?? null,
      destinatario: (data.destinatario as string | null) ?? null,
      sinCuerpo: false,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reservas] getReservaEmailCuerpo:", msg);
    return { ok: false, html: null as string | null };
  }
}
