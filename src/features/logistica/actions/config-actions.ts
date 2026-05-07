"use server";

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import {
  getCategorias, getFamilias, ESTADOS_PRODUCTO,
  type TipoProducto,
} from "@/features/logistica/data/productos";

type Seccion = "categorias" | "familias" | "estados" | "umbral_coste";
type ConfigTipo = TipoProducto | "global";

/** Lee los valores de una sección. Si no existe en BD devuelve los defaults. */
export async function getProductoConfigSection(
  tipo: ConfigTipo,
  seccion: Seccion,
): Promise<string[]> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return defaultValues(tipo, seccion);

    const { data } = await supabase
      .from("productos_config")
      .select("valores")
      .eq("empresa_id", empresaId)
      .eq("tipo", tipo)
      .eq("seccion", seccion)
      .maybeSingle();

    return (data?.valores as string[] | null) ?? defaultValues(tipo, seccion);
  } catch {
    return defaultValues(tipo, seccion);
  }
}

/** Guarda (upsert) los valores de una sección. */
export async function saveProductoConfigSection(
  tipo: ConfigTipo,
  seccion: Seccion,
  valores: string[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, error: "No se encontró la empresa" };

    const { error } = await supabase
      .from("productos_config")
      .upsert(
        { empresa_id: empresaId, tipo, seccion, valores },
        { onConflict: "empresa_id,tipo,seccion" },
      );

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function defaultValues(tipo: ConfigTipo, seccion: Seccion): string[] {
  if (seccion === "estados") return [...ESTADOS_PRODUCTO];
  if (seccion === "umbral_coste") return ["30", "40"];
  if (tipo === "global") return [];
  if (seccion === "categorias") return getCategorias(tipo as TipoProducto);
  return getFamilias(tipo as TipoProducto);
}
