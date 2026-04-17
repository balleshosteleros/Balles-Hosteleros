"use server";

/**
 * Persistencia de bloques en paginas_web.bloques (JSONB).
 * Valida cada bloque con su Zod schema antes de guardar (PRP-029 — Fase 4).
 */
import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/supabase/get-context";
import { bloquesArraySchema } from "../services/bloque-schemas";
import { sanitizarBloqueTextoLibre } from "../services/sanitize-html";
import type { Bloque } from "../types";

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

export async function guardarBloques(
  paginaId: string,
  bloques: Bloque[],
): Promise<ActionResult<{ updated_at: string }>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    // Sanitizar HTML de bloques texto_libre ANTES de validar + persistir
    const sanitizados = bloques.map((b) => sanitizarBloqueTextoLibre(b));

    const parsed = bloquesArraySchema.safeParse(sanitizados);
    if (!parsed.success) {
      console.error("[pagina-web][guardarBloques] validation:", parsed.error.issues);
      return { ok: false, error: "Validación fallida en alguno de los bloques." };
    }

    const { data, error } = await supabase
      .from("paginas_web")
      .update({ bloques: parsed.data })
      .eq("id", paginaId)
      .eq("empresa_id", empresaId)
      .select("updated_at")
      .single();

    if (error) {
      console.error("[pagina-web][guardarBloques]", error.message);
      return { ok: false, error: "No se pudo guardar." };
    }

    revalidatePath(`/marketing/pagina-web/${paginaId}`);
    return { ok: true, data: { updated_at: (data as { updated_at: string }).updated_at } };
  } catch (err) {
    console.error("[pagina-web][guardarBloques] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}
