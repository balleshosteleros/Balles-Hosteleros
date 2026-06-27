"use server";

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import {
  ESTADOS_PRODUCTO,
  type TipoProducto,
} from "@/features/logistica/data/productos";

type Seccion = "categorias" | "estados" | "umbral_coste" | "iva_default";
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
  if (seccion === "iva_default") {
    // IVA por defecto del software (mientras la empresa no lo cambie en Ajustes):
    //   venta  → 10% (tipo reducido de hostelería)
    //   compra → 21% (general; un precio de compra nunca queda sin IVA)
    if (tipo === "venta") return ["10%"];
    if (tipo === "compra") return ["21%"];
    return [];
  }
  return [];
}

/* ─── IVA por defecto por tipo de producto ───
   Configurable en Ajustes de Logística → Productos. Un único código por tipo
   (p.ej. "21%"). Devuelve null si la empresa aún no lo ha configurado; el
   consumidor decide el fallback (normalmente IVA_DEFAULT / pickDefaultIva). */

/** Lee el IVA por defecto configurado para un tipo de producto (compra/venta). */
export async function getDefaultIva(
  tipo: "compra" | "venta",
): Promise<string | null> {
  const valores = await getProductoConfigSection(tipo, "iva_default");
  return valores[0] ?? null;
}

/** Guarda el IVA por defecto para un tipo de producto (compra/venta). */
export async function saveDefaultIva(
  tipo: "compra" | "venta",
  codigo: string,
): Promise<{ ok: boolean; error?: string }> {
  return saveProductoConfigSection(tipo, "iva_default", [codigo]);
}
