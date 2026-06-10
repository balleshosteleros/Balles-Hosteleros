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

/**
 * Búsqueda RAG con candado de rol (PRP-055).
 *
 * El filtro de módulos va DENTRO de la RPC (no se filtra después): la query
 * vectorial NUNCA devuelve chunks de un módulo no permitido. Si `modulos` está
 * vacío, no hay nada que el usuario pueda ver → devolvemos [].
 */
export async function buscarConocimiento(
  pregunta: string,
  modulos: string[],
  topK = 6,
): Promise<ChunkRecuperado[]> {
  if (!pregunta.trim() || modulos.length === 0) return [];

  const embedding = await generarEmbedding(pregunta);
  if (!embedding) return [];

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("buscar_soporte_conocimiento", {
    query_embedding: JSON.stringify(embedding),
    modulos_permitidos: modulos,
    top_k: topK,
  });

  if (error) {
    console.error("[buscarConocimiento]", error);
    return [];
  }
  return (data ?? []) as ChunkRecuperado[];
}
