import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getPlaceDetails,
  getGoogleMapsApiKey,
  estadoDesdeRating,
} from "@/lib/google/places";

export interface SyncGoogleResult {
  ok: boolean;
  insertadas: number;
  actualizadas: number;
  total: number;
  error?: string;
}

export async function syncResenasGoogleForEmpresa(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<SyncGoogleResult> {
  if (!getGoogleMapsApiKey()) {
    return {
      ok: false,
      error: "MISSING_GOOGLE_MAPS_API_KEY",
      insertadas: 0,
      actualizadas: 0,
      total: 0,
    };
  }

  const { data: emp } = await supabase
    .from("empresas")
    .select("google_place_id")
    .eq("id", empresaId)
    .maybeSingle();
  const placeId = emp?.google_place_id as string | null | undefined;
  if (!placeId) {
    return {
      ok: false,
      error: "EMPRESA_SIN_PLACE_ID",
      insertadas: 0,
      actualizadas: 0,
      total: 0,
    };
  }

  const details = await getPlaceDetails(placeId);
  if (!details) {
    return {
      ok: false,
      error: "PLACE_NO_ENCONTRADO",
      insertadas: 0,
      actualizadas: 0,
      total: 0,
    };
  }

  if (details.reviews.length === 0) {
    return { ok: true, insertadas: 0, actualizadas: 0, total: 0 };
  }

  const externalIds = details.reviews.map((r) => r.externalId);
  const { data: existentes } = await supabase
    .from("resenas")
    .select("id, external_id")
    .eq("empresa_id", empresaId)
    .in("external_id", externalIds);

  const existentesMap = new Map<string, string>();
  for (const row of existentes ?? []) {
    const eid = (row as { external_id: string | null }).external_id;
    if (eid) existentesMap.set(eid, (row as { id: string }).id);
  }

  let insertadas = 0;
  let actualizadas = 0;
  const nowIso = new Date().toISOString();

  for (const rev of details.reviews) {
    const existingId = existentesMap.get(rev.externalId);
    if (existingId) {
      const { error: errUpd } = await supabase
        .from("resenas")
        .update({
          autor_avatar: rev.authorAvatar,
          autor_url: rev.authorUrl,
          comentario: rev.text || null,
          rating: rev.rating,
          fecha_reseña: rev.time,
          synced_at: nowIso,
        })
        .eq("id", existingId);
      if (!errUpd) actualizadas++;
    } else {
      const { error: errIns } = await supabase.from("resenas").insert({
        empresa_id: empresaId,
        nombre_comensal: rev.authorName,
        comentario: rev.text || null,
        rating: rev.rating,
        estado: estadoDesdeRating(rev.rating),
        origen: "google",
        external_id: rev.externalId,
        autor_url: rev.authorUrl,
        autor_avatar: rev.authorAvatar,
        fecha_reseña: rev.time,
        synced_at: nowIso,
      });
      if (!errIns) insertadas++;
    }
  }

  return {
    ok: true,
    insertadas,
    actualizadas,
    total: details.reviews.length,
  };
}
