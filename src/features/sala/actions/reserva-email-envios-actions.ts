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
      .select("id, tipo, destinatario, asunto, usuario_nombre, origen, enviado_at")
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
    }));
    return { ok: true, data: envios };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reservas] listReservaEmailEnvios:", msg);
    return { ok: false, data: [] as ReservaEmailEnvio[] };
  }
}
