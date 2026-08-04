import "server-only";

/**
 * Traza append-only del ciclo de albaranes (PRP-073): `albaran_eventos`.
 * Compartido por las actions de importación y de albaranes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Evento append-only. Nunca rompe el flujo principal si falla. */
export async function registrarEventoAlbaran(
  supabase: SupabaseClient,
  ev: {
    empresaId: string;
    importacionId?: string | null;
    albaranId?: string | null;
    actorId?: string | null;
    tipo: string;
    /** NUNCA fichero, base64 ni secretos. */
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await supabase.from("albaran_eventos").insert({
      empresa_id: ev.empresaId,
      importacion_id: ev.importacionId ?? null,
      albaran_id: ev.albaranId ?? null,
      actor_id: ev.actorId ?? null,
      tipo: ev.tipo,
      payload: ev.payload ?? null,
    });
  } catch (err) {
    console.error("[albaran-eventos] registrarEventoAlbaran:", err);
  }
}
