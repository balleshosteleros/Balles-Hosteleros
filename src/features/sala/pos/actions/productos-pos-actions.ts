"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import type { ProductoPOS, LineaDestino } from "../types";

/**
 * Devuelve productos tipo 'venta' activos para el POS.
 * Alias a ProductoPOS (camelCase) con defaults seguros.
 */
export async function listProductosPOS(): Promise<
  { ok: true; data: ProductoPOS[] } | { ok: false; error: string }
> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: true, data: [] };

    const { data, error } = await supabase
      .from("productos")
      .select("id, nombre, categoria, familia, precio_venta, tipo, estado")
      .eq("empresa_id", empresaId)
      .eq("tipo", "venta")
      .eq("estado", "Activo")
      .order("categoria", { ascending: true })
      .order("nombre", { ascending: true });

    if (error) throw error;

    const mapped: ProductoPOS[] = (data ?? []).map((p) => {
      const familia = (p as { familia: string | null }).familia;
      // Heurística: familias típicas de barra → BARRA; resto → COCINA
      const esBarra = familia && /bebida|refresco|caf[eé]|licor|cerveza|vino/i.test(familia);
      const destino: LineaDestino = esBarra ? "BARRA" : "COCINA";
      // IVA por defecto: 10% restauración; bebidas alcohólicas 21% (heurística)
      const ivaPct = familia && /licor|cerveza|vino|alcohol/i.test(familia) ? 21 : 10;
      // precio_venta viene como text en BD → parseamos con tolerancia a comas
      const pvRaw = (p as { precio_venta: string | number | null }).precio_venta;
      const pvNum = pvRaw == null ? 0 : Number(String(pvRaw).replace(",", "."));
      return {
        id: p.id as string,
        nombre: p.nombre as string,
        categoria: (p.categoria as string) ?? "Sin categoría",
        familia: familia ?? null,
        precioVenta: isNaN(pvNum) ? 0 : pvNum,
        ivaPct,
        imagenUrl: null,
        destino,
      };
    });

    return { ok: true, data: mapped };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pos][productos] listProductosPOS:", msg);
    return { ok: false, error: msg };
  }
}
