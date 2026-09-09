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
  /**
   * Las 5 reseñas que devuelve Google (su máximo) eran todas nuevas, así que
   * es probable que hubiera más sin recoger. Solo lo rellena la sincronización
   * manual, para avisar en pantalla.
   */
  cupoLleno?: boolean;
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

  // Foto del día ANTES de mirar las reseñas: el contador total y la nota son
  // el único dato exacto que da Google (las reseñas vienen de 5 en 5, así que
  // contar filas de `resenas` no dice cuántas tiene el local). Guardarlo a
  // diario construye la línea base sin la que no se puede afirmar que una
  // campaña traiga reseñas: ver `resenas_metricas_diarias`.
  //
  // Va antes del corte por `reviews.length === 0` a propósito: un día sin
  // reseñas nuevas también es un dato de la serie, y perderlo dejaría huecos.
  await guardarMetricaDiaria(supabase, empresaId, details);

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

/**
 * Guarda (o refresca) la foto de hoy: total de reseñas y nota media de la ficha.
 *
 * Silencioso a propósito: es una métrica, no puede tumbar la sincronización de
 * reseñas si falla. La fecha es la del local, no la del servidor, porque el
 * cron corre de madrugada en UTC y si no la serie se desplazaría un día.
 */
async function guardarMetricaDiaria(
  supabase: SupabaseClient,
  empresaId: string,
  details: { rating: number | null; totalRatings: number | null },
): Promise<void> {
  try {
    const { data: emp } = await supabase
      .from("empresas")
      .select("config_operativa")
      .eq("id", empresaId)
      .maybeSingle();
    const cfg = (emp?.config_operativa as { zonaHoraria?: string } | null) ?? null;
    const tz = cfg?.zonaHoraria || "Europe/Madrid";
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());

    await supabase.from("resenas_metricas_diarias").upsert(
      {
        empresa_id: empresaId,
        fecha: hoy,
        plataforma: "google",
        total_resenas: details.totalRatings,
        nota_media: details.rating,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "empresa_id,fecha,plataforma" },
    );
  } catch (err) {
    console.error("[resenas-google-sync] guardarMetricaDiaria:", err);
  }
}
