import type { SupabaseClient } from "@supabase/supabase-js";

/** Código reservado del enlace por defecto del portal de empleo (el de la web). */
export const CODIGO_WEB = "WEB";

export interface WebLinkRow {
  id: string;
  codigo: string;
  nombre: string;
  origen_categoria: string;
}

/**
 * Devuelve el enlace WEB por defecto de la empresa, creándolo si no existe.
 * Es el canal al que se atribuye cualquier candidatura que llega sin un enlace concreto.
 */
export async function ensureWebLink(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<WebLinkRow | null> {
  const cols = "id, codigo, nombre, origen_categoria";

  const { data: existing } = await supabase
    .from("empleo_links")
    .select(cols)
    .eq("empresa_id", empresaId)
    .ilike("codigo", CODIGO_WEB)
    .maybeSingle();
  if (existing) return existing as WebLinkRow;

  const { data: created, error } = await supabase
    .from("empleo_links")
    .insert({
      empresa_id: empresaId,
      codigo: CODIGO_WEB,
      nombre: "Web",
      origen_categoria: "web",
      protegido: true,
      activo: true,
    })
    .select(cols)
    .single();

  if (error) {
    // Carrera: otra petición lo creó primero (índice único por empresa+código).
    const { data: again } = await supabase
      .from("empleo_links")
      .select(cols)
      .eq("empresa_id", empresaId)
      .ilike("codigo", CODIGO_WEB)
      .maybeSingle();
    return (again as WebLinkRow) ?? null;
  }
  return created as WebLinkRow;
}
