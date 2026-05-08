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
      .select("id, nombre, categoria, precio_venta, tipo, estado, estilo_color, estilo_imagen_url")
      .eq("empresa_id", empresaId)
      .eq("tipo", "venta")
      .eq("estado", "Activo")
      .order("categoria", { ascending: true })
      .order("nombre", { ascending: true });

    if (error) throw error;

    const RE_BARRA = /coct|bebida|refresco|caf[eé]|t[eé]|licor|cerveza|vino|champagne|whisky|vodka|ron|gin|frapp|zumo|milshake|botella|infusi/i;
    const RE_IVA_21 = /coct|licor|cerveza|vino|alcohol|champagne|whisky|vodka|ron|gin/i;

    const mapped: ProductoPOS[] = (data ?? []).map((p) => {
      const categoria = (p.categoria as string) ?? "";
      const destino: LineaDestino = RE_BARRA.test(categoria) ? "BARRA" : "COCINA";
      const ivaPct = RE_IVA_21.test(categoria) ? 21 : 10;
      const pvRaw = (p as { precio_venta: string | number | null }).precio_venta;
      const pvNum = pvRaw == null ? 0 : Number(String(pvRaw).replace(",", "."));
      const estiloColor = (p as { estilo_color: string | null }).estilo_color ?? null;
      const estiloImagenUrl = (p as { estilo_imagen_url: string | null }).estilo_imagen_url ?? null;
      return {
        id: p.id as string,
        nombre: p.nombre as string,
        categoria: categoria || "Sin categoría",
        precioVenta: isNaN(pvNum) ? 0 : pvNum,
        ivaPct,
        imagenUrl: estiloImagenUrl,
        colorBg: estiloColor,
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
