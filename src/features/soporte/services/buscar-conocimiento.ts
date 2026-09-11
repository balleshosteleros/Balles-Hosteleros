import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { generarEmbedding } from "@/lib/ia/embeddings";

export interface ChunkRecuperado {
  id: string;
  modulo: string;
  titulo: string;
  contenido: string;
  enlaces: { titulo: string; url: string }[];
  videos: { titulo: string; url: string; duracion_min?: number }[];
  distancia: number;
}

export interface Recuperacion {
  /** Embedding de la pregunta. Se devuelve para no volver a calcularlo. */
  embedding: number[] | null;
  chunks: ChunkRecuperado[];
}

/**
 * Búsqueda con candado de rol (PRP-055).
 *
 * El filtro de módulos va DENTRO de la consulta vectorial, no se filtra después:
 * la búsqueda NUNCA llega a devolver un chunk de un módulo que el rol no ve. Si
 * `modulos` viene vacío no hay nada que ese usuario pueda ver → se devuelve
 * vacío sin ir a la base de datos.
 */
export async function buscarConocimiento(
  pregunta: string,
  modulos: string[],
  topK = 6,
): Promise<ChunkRecuperado[]> {
  const { chunks } = await recuperarConocimiento(pregunta, modulos, topK);
  return chunks;
}

/** Igual que `buscarConocimiento`, pero devuelve además el embedding calculado. */
export async function recuperarConocimiento(
  pregunta: string,
  modulos: string[],
  topK = 6,
): Promise<Recuperacion> {
  if (!pregunta.trim() || modulos.length === 0) return { embedding: null, chunks: [] };

  const embedding = await generarEmbedding(pregunta);
  if (!embedding) return { embedding: null, chunks: [] };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("buscar_soporte_conocimiento", {
    query_embedding: JSON.stringify(embedding),
    modulos_permitidos: modulos,
    top_k: topK,
  });

  if (error) {
    console.error("[buscarConocimiento]", error);
    return { embedding, chunks: [] };
  }
  return { embedding, chunks: (data ?? []) as ChunkRecuperado[] };
}

/**
 * A qué distancia está la pregunta de lo MÁS parecido que sabe el software,
 * mirando toda la base y sin candado de módulos.
 *
 * Sirve solo para decidir el mensaje cuando no podemos responder: si no se
 * parece a nada, es que no es información de la empresa; si se parece pero no lo
 * suficiente, es que falta escribirlo.
 *
 * Devuelve el módulo y la distancia, NUNCA contenido: por este camino no se
 * puede sacar información de un módulo que no se ve.
 */
export async function distanciaAlConocimiento(
  embedding: number[] | null,
): Promise<{ modulo: string | null; distancia: number }> {
  if (!embedding) return { modulo: null, distancia: 1 };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("distancia_conocimiento_global", {
    query_embedding: JSON.stringify(embedding),
  });
  if (error) {
    console.error("[distanciaAlConocimiento]", error);
    return { modulo: null, distancia: 1 };
  }
  const fila = (data ?? [])[0] as { modulo: string; distancia: number } | undefined;
  return { modulo: fila?.modulo ?? null, distancia: fila?.distancia ?? 1 };
}
