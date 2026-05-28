"use server";

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import type { EscandalloImport } from "@/features/logistica/types/import";
import type { EscandalloRow, NecesidadCompraRow } from "@/features/logistica/types/db";

async function getContext() {
  const { supabase, userId, empresaId } = await getLogisticaContext();
  return { supabase, user: userId ? { id: userId } : null, empresaId };
}

/**
 * Lista los escandallos de un plato concreto.
 */
export async function listEscandallos(productoVentaId: string) {
  try {
    const { supabase } = await getContext();
    const { data, error } = await supabase
      .from("producto_composicion")
      .select("*, ingrediente:ingrediente_id(id, nombre, unidad, unidad_uso, factor_conversion)")
      .eq("producto_venta_id", productoVentaId);
    if (error) throw error;
    return { ok: true as const, data: data ?? [] };
  } catch (err) {
    console.error("[escandallos] listEscandallos:", err);
    return { ok: false as const, data: [] };
  }
}

export async function addEscandallo(input: {
  productoVentaId: string;
  ingredienteId: string;
  cantidad: number;
  mermaPct?: number;
  observaciones?: string | null;
}) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.from("producto_composicion").insert({
      producto_venta_id: input.productoVentaId,
      ingrediente_id: input.ingredienteId,
      cantidad: input.cantidad,
      merma_pct: input.mermaPct ?? 0,
      observaciones: input.observaciones ?? null,
    });
    if (error) throw error;
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[escandallos] addEscandallo:", msg);
    return { ok: false as const, error: msg };
  }
}

export async function removeEscandallo(id: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.from("producto_composicion").delete().eq("id", id);
    if (error) throw error;
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[escandallos] removeEscandallo:", msg);
    return { ok: false as const, error: msg };
  }
}

/**
 * Devuelve alérgenos derivados (UNION) del producto y de todos los ingredientes
 * de su escandallo, recursivamente. Pensado para elaboraciones y productos venta.
 */
export async function getAlergenosDerivados(productoId: string) {
  try {
    const { supabase } = await getContext();
    const { data, error } = await supabase.rpc("alergenos_derivados", { p_producto_id: productoId });
    if (error) throw error;
    return { ok: true as const, data: (data as string[] | null) ?? [] };
  } catch (err) {
    console.error("[escandallos] getAlergenosDerivados:", err);
    return { ok: false as const, data: [] };
  }
}

export type AlergenoOrigen = {
  alergeno: string;
  origenId: string;
  origenNombre: string;
  origenTipo: "compra" | "venta" | "elaboracion";
};

export async function getAlergenosDerivadosOrigen(productoId: string) {
  try {
    const { supabase } = await getContext();
    const { data, error } = await supabase.rpc("alergenos_derivados_origen", { p_producto_id: productoId });
    if (error) throw error;
    const rows = (data as Array<{ alergeno: string; origen_id: string; origen_nombre: string; origen_tipo: string }> | null) ?? [];
    return {
      ok: true as const,
      data: rows.map<AlergenoOrigen>((r) => ({
        alergeno: r.alergeno,
        origenId: r.origen_id,
        origenNombre: r.origen_nombre,
        origenTipo: r.origen_tipo as AlergenoOrigen["origenTipo"],
      })),
    };
  } catch (err) {
    console.error("[escandallos] getAlergenosDerivadosOrigen:", err);
    return { ok: false as const, data: [] as AlergenoOrigen[] };
  }
}

/**
 * Importación masiva de escandallos.
 * Resuelve nombres → IDs contra la BD (productos de venta + ingredientes).
 */
export async function bulkImportEscandallos(escandallos: EscandalloImport[]) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado", imported: 0, skipped: 0, errors: [] };

    if (!Array.isArray(escandallos) || escandallos.length === 0) {
      return { ok: false as const, error: "No hay escandallos para importar", imported: 0, skipped: 0, errors: [] };
    }

    // Cargar catálogo de productos para resolver nombres → IDs
    const { data: productos, error: pErr } = await supabase
      .from("productos")
      .select("id, nombre, tipo, agora_id")
      .eq("empresa_id", empresaId);
    if (pErr) throw pErr;

    const ventaByKey = new Map<string, string>();
    const compraByKey = new Map<string, string>();

    for (const p of productos ?? []) {
      const row = p as { id: string; nombre: string; tipo: "compra" | "venta"; agora_id: string | null };
      const byName = row.nombre.toLowerCase().trim();
      if (row.tipo === "venta") {
        ventaByKey.set(byName, row.id);
        if (row.agora_id) ventaByKey.set(row.agora_id.toLowerCase().trim(), row.id);
      } else {
        compraByKey.set(byName, row.id);
      }
    }

    const rows: Array<{
      producto_venta_id: string;
      ingrediente_id: string;
      cantidad: number;
      merma_pct: number;
      observaciones: string | null;
    }> = [];

    const errors: Array<{ row: number; reason: string; data?: unknown }> = [];

    escandallos.forEach((e, idx) => {
      const ventaId = ventaByKey.get(e.productoVenta.toLowerCase().trim());
      const ingId = compraByKey.get(e.ingrediente.toLowerCase().trim());

      if (!ventaId) {
        errors.push({ row: idx + 1, reason: `Plato no encontrado: "${e.productoVenta}"`, data: e });
        return;
      }
      if (!ingId) {
        errors.push({ row: idx + 1, reason: `Ingrediente no encontrado: "${e.ingrediente}"`, data: e });
        return;
      }

      rows.push({
        producto_venta_id: ventaId,
        ingrediente_id: ingId,
        cantidad: e.cantidad,
        merma_pct: e.mermaPct ?? 0,
        observaciones: e.observaciones ?? null,
      });
    });

    if (rows.length === 0) {
      return {
        ok: false as const,
        error: "Ningún escandallo pudo resolverse. Revisa que los nombres coincidan con productos ya importados.",
        imported: 0,
        skipped: escandallos.length,
        errors,
      };
    }

    // upsert para re-importaciones (unique en producto_venta_id + ingrediente_id)
    const { error } = await supabase
      .from("producto_composicion")
      .upsert(rows, { onConflict: "producto_venta_id,ingrediente_id" });
    if (error) throw error;

    return {
      ok: true as const,
      imported: rows.length,
      skipped: escandallos.length - rows.length,
      errors,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[escandallos] bulkImportEscandallos:", msg);
    return { ok: false as const, error: msg, imported: 0, skipped: 0, errors: [] };
  }
}

/**
 * Lista los escandallos de un plato incluyendo el precio preferido de cada ingrediente
 * (de la tabla ingredientes_proveedor donde es_preferido = true).
 * Usado para mostrar Precio/u y Subtotal en la ficha del producto.
 */
export async function listEscandallosConPrecios(productoVentaId: string) {
  try {
    const { supabase } = await getContext();

    const { data, error } = await supabase
      .from("producto_composicion")
      .select("id, ingrediente_id, cantidad, merma_pct, ingrediente:ingrediente_id(id, nombre, unidad, factor_conversion)")
      .eq("producto_venta_id", productoVentaId);

    if (error) throw error;
    if (!data?.length) return { ok: true as const, data: [] };

    // Obtener precios preferidos de cada ingrediente en una sola query
    const ingredienteIds = data.map((r) => r.ingrediente_id);
    const { data: precios } = await supabase
      .from("ingredientes_proveedor")
      .select("producto_id, precio_unitario")
      .in("producto_id", ingredienteIds)
      .eq("es_preferido", true);

    const precioMap = new Map<string, number>();
    for (const p of precios ?? []) {
      precioMap.set(p.producto_id, Number(p.precio_unitario ?? 0));
    }

    const result = data.map((r) => {
      const ing = r.ingrediente as unknown as { id: string; nombre: string; unidad: string; factor_conversion: number } | null;
      const cantidad = Number(r.cantidad ?? 0);
      const mermaPct = Number(r.merma_pct ?? 0);
      const factorConversion = Number(ing?.factor_conversion ?? 1) || 1;
      const precioUnitario = precioMap.get(r.ingrediente_id) ?? 0;
      const real = cantidad * (1 + mermaPct / 100);
      const subtotal = (real * precioUnitario) / factorConversion;

      return {
        id: r.id,
        ingredienteId: r.ingrediente_id,
        ingredienteNombre: ing?.nombre ?? "—",
        ingredienteUnidad: ing?.unidad ?? "",
        cantidad,
        mermaPct,
        precioUnitario,
        subtotal: Math.round(subtotal * 1000) / 1000,
      };
    });

    return { ok: true as const, data: result };
  } catch (err) {
    console.error("[escandallos] listEscandallosConPrecios:", err);
    return { ok: false as const, data: [] };
  }
}

/**
 * Calcula el food cost de un plato llamando a la función SQL coste_escandallo().
 */
export async function getCosteEscandallo(productoVentaId: string) {
  try {
    const { supabase } = await getContext();
    const { data, error } = await supabase.rpc("coste_escandallo", {
      p_producto_venta_id: productoVentaId,
    });
    if (error) throw error;
    return { ok: true as const, coste: Number(data ?? 0) };
  } catch (err) {
    console.error("[escandallos] getCosteEscandallo:", err);
    return { ok: false as const, coste: 0 };
  }
}

/**
 * Llama a calcular_necesidad_compra() para obtener la lista de compra automática.
 */
export async function getNecesidadCompra() {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, data: [] as NecesidadCompraRow[] };

    const { data, error } = await supabase.rpc("calcular_necesidad_compra", {
      p_empresa_id: empresaId,
    });
    if (error) throw error;
    return { ok: true as const, data: (data ?? []) as NecesidadCompraRow[] };
  } catch (err) {
    console.error("[escandallos] getNecesidadCompra:", err);
    return { ok: false as const, data: [] as NecesidadCompraRow[] };
  }
}
