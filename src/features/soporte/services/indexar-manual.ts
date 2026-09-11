import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { generarEmbeddings } from "@/lib/ia/embeddings";
import { MANUAL_SOFTWARE, type ArticuloManual } from "@/lib/soporte/manual";

/**
 * Mete el manual del software en la base de conocimiento del asistente.
 *
 * Idempotente por `origen_ref`: volver a pasarlo actualiza los artículos que
 * hayan cambiado y no duplica ninguno. Lo que ya no está en el manual se
 * desactiva (no se borra: puede haber consultas antiguas que lo referencian).
 *
 * No gasta nada de IA: los embeddings los hace el motor propio de Supabase.
 */

/**
 * Cuántos textos se embeben por llamada.
 *
 * Muy bajo a propósito. La función de embeddings de Supabase carga el modelo en
 * memoria y con lotes grandes se queda sin recursos (`WORKER_RESOURCE_LIMIT`) y
 * devuelve 546: los artículos se guardaban SIN embedding y el asistente no los
 * encontraba jamás, sin que nada fallara a la vista. De cuatro en cuatro aguanta.
 */
const LOTE = 4;

/** Reintentos por lote: el 546 es por carga puntual y a la segunda suele ir. */
const REINTENTOS = 3;

async function embeddingsConReintento(textos: string[]): Promise<number[][] | null> {
  for (let intento = 0; intento < REINTENTOS; intento++) {
    const out = await generarEmbeddings(textos);
    if (out && out.length === textos.length) return out;
    await new Promise((r) => setTimeout(r, 1000 * (intento + 1)));
  }
  return null;
}

export interface ResultadoIndexado {
  total: number;
  insertados: number;
  actualizados: number;
  desactivados: number;
  sinEmbedding: number;
}

function textoParaEmbedding(a: ArticuloManual): string {
  return `${a.titulo}\n\n${a.contenido}`.trim();
}

function enlacesDe(a: ArticuloManual): { titulo: string; url: string }[] {
  if (!a.ruta) return [];
  return [{ titulo: a.rutaTitulo || a.titulo, url: a.ruta }];
}

export async function indexarManualSoftware(): Promise<ResultadoIndexado> {
  const admin = createAdminClient();

  // Qué hay ya indexado, para saber qué es alta y qué es cambio.
  const { data: existentes } = await admin
    .from("soporte_conocimiento")
    .select("id, origen_ref, contenido, titulo")
    .eq("fuente", "software");

  const previos = new Map(
    ((existentes ?? []) as { origen_ref: string | null; contenido: string; titulo: string }[])
      .filter((r) => r.origen_ref)
      .map((r) => [r.origen_ref as string, r]),
  );

  let insertados = 0;
  let actualizados = 0;
  let sinEmbedding = 0;

  for (let i = 0; i < MANUAL_SOFTWARE.length; i += LOTE) {
    const lote = MANUAL_SOFTWARE.slice(i, i + LOTE);
    const embeddings = await embeddingsConReintento(lote.map(textoParaEmbedding));

    const filas = lote.map((a, j) => {
      const emb = embeddings?.[j] ?? null;
      if (!emb) sinEmbedding += 1;
      const previo = previos.get(a.ref);
      if (previo) {
        if (previo.titulo !== a.titulo || previo.contenido !== a.contenido) actualizados += 1;
      } else {
        insertados += 1;
      }
      return {
        fuente: "software" as const,
        origen_ref: a.ref,
        modulo: a.modulo,
        titulo: a.titulo,
        contenido: a.contenido,
        enlaces: enlacesDe(a),
        videos: [],
        // pgvector espera el literal '[0.1,0.2,…]', no un array JS crudo.
        embedding: emb ? JSON.stringify(emb) : null,
        activo: true,
        updated_at: new Date().toISOString(),
      };
    });

    const { error } = await admin
      .from("soporte_conocimiento")
      .upsert(filas, { onConflict: "origen_ref" });
    if (error) throw new Error(`No se pudo indexar el manual: ${error.message}`);
  }

  // Artículos que se quitaron del manual: fuera del índice, pero sin borrar.
  const refsVivas = new Set(MANUAL_SOFTWARE.map((a) => a.ref));
  const aDesactivar = [...previos.keys()].filter((ref) => !refsVivas.has(ref));
  if (aDesactivar.length > 0) {
    await admin
      .from("soporte_conocimiento")
      .update({ activo: false })
      .eq("fuente", "software")
      .in("origen_ref", aDesactivar);
  }

  return {
    total: MANUAL_SOFTWARE.length,
    insertados,
    actualizados,
    desactivados: aDesactivar.length,
    sinEmbedding,
  };
}
