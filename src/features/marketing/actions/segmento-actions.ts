"use server";

import { getMarketingContext } from "@/features/marketing/lib/supabase-context";
import { contarSegmento } from "@/features/marketing/lib/segmento-resolver";
import type { SegmentoJson } from "@/features/marketing/data/campanas";

export async function previewSegmentoAction(segmento: SegmentoJson) {
  try {
    const { supabase, empresaId } = await getMarketingContext();
    if (!empresaId) return { ok: false as const, count: 0, error: "Sin empresa" };
    const count = await contarSegmento(supabase, empresaId, segmento);
    return { ok: true as const, count };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return { ok: false as const, count: 0, error: msg };
  }
}
