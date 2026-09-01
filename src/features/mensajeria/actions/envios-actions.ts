"use server";

/**
 * Lectura del histórico de WhatsApp y SMS de una reserva.
 *
 * Solo lectura: el histórico lo escribe el orquestador de envío y nadie más.
 */

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanalMensajeria } from "@/features/mensajeria/data/monedero";

export type EstadoEnvio = "PENDIENTE" | "ENVIADO" | "ENTREGADO" | "LEIDO" | "FALLIDO";

export type TipoEnvio =
  | "CONFIRMACION"
  | "RECONFIRMACION"
  | "RECORDATORIO"
  | "CANCELACION"
  | "CAMPANA";

export interface MensajeriaEnvio {
  id: string;
  canal: CanalMensajeria;
  tipo: TipoEnvio;
  destinatario: string;
  estado: EstadoEnvio;
  errorMensaje: string | null;
  costeCents: number;
  usuarioNombre: string | null;
  origen: "MANUAL" | "AUTOMATICO" | "PORTAL_PUBLICO";
  enviadoAt: string;
}

/** Envíos de una reserva, del más reciente al más antiguo. */
export async function listMensajeriaEnvios(reservaId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, data: [] as MensajeriaEnvio[] };

    const empresaId = await getEmpresaActivaForUser(
      supabase as unknown as SupabaseClient,
      user.id,
    );
    if (!empresaId) return { ok: false, data: [] as MensajeriaEnvio[] };

    // El filtro por empresa va explícito: la RLS acota a las empresas DEL
    // usuario, no a la ACTIVA.
    const { data, error } = await supabase
      .from("mensajeria_envios")
      .select("id, canal, tipo, destinatario, estado, error_mensaje, coste_cents, usuario_nombre, origen, enviado_at")
      .eq("reserva_id", reservaId)
      .eq("empresa_id", empresaId)
      .order("enviado_at", { ascending: false });
    if (error) throw error;

    const envios: MensajeriaEnvio[] = (data ?? []).map((row) => ({
      id: row.id as string,
      canal: row.canal as CanalMensajeria,
      tipo: row.tipo as TipoEnvio,
      destinatario: row.destinatario as string,
      estado: row.estado as EstadoEnvio,
      errorMensaje: (row.error_mensaje as string | null) ?? null,
      costeCents: (row.coste_cents as number | null) ?? 0,
      usuarioNombre: (row.usuario_nombre as string | null) ?? null,
      origen: row.origen as MensajeriaEnvio["origen"],
      enviadoAt: row.enviado_at as string,
    }));

    return { ok: true, data: envios };
  } catch {
    return { ok: false, data: [] as MensajeriaEnvio[] };
  }
}
