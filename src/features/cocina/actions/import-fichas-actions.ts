"use server";

/**
 * Server actions del importador de fichas técnicas — PRP-071, Fase 3.
 * previewFichas: parsea el Excel + empareja contra candidatos de la empresa
 * activa, SIN escribir nada en BD. La escritura es de la Fase 4.
 */

import { getAppContext } from "@/lib/supabase/get-context";
import { parseFichasBuffer } from "@/features/cocina/services/import-fichas/parser";
import { construirPreview } from "@/features/cocina/services/import-fichas/preview";
import type { Candidato, PreviewResult } from "@/features/cocina/services/import-fichas/types";

export type PreviewResponse =
  | { ok: true; data: PreviewResult }
  | { ok: false; error: string };

/**
 * Recibe el Excel como base64 (lo manda el cliente tras leer el File), lo
 * parsea y devuelve la previsualización emparejada contra los productos de
 * compra + elaboraciones de la empresa ACTIVA.
 */
export async function previewFichas(base64: string): Promise<PreviewResponse> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No hay empresa activa." };

    // Candidatos = productos de compra + elaboraciones de la empresa.
    const { data: prods, error } = await supabase
      .from("productos")
      .select("id,nombre,tipo,categoria")
      .eq("empresa_id", empresaId)
      .in("tipo", ["compra", "elaboracion"]);
    if (error) throw error;

    const candidatos: Candidato[] = (prods ?? []).map((p) => ({
      id: p.id as string,
      nombre: p.nombre as string,
      tipo: p.tipo as "compra" | "elaboracion",
      categoria: (p.categoria as string | null) ?? null,
    }));

    // Decodificar base64 → bytes y parsear con el módulo de Fase 1.
    const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
    const parsed = parseFichasBuffer(bytes);

    const preview = construirPreview(empresaId, parsed, candidatos);
    return { ok: true, data: preview };
  } catch (err) {
    console.error("[import-fichas] previewFichas:", err);
    return { ok: false, error: "No se pudo procesar el Excel." };
  }
}
