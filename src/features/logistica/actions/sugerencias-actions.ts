"use server";

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";

const SIN_PROVEEDOR_ID = "__sin_proveedor__";
const SIN_PROVEEDOR_LABEL = "Sin proveedor asignado";

export interface SugerenciaLinea {
  producto_id: string;
  nombre: string;
  unidad: string;
  stock_actual: number;
  stock_maximo: number;
  cantidad_propuesta: number;
  precio_estimado: number;
  ventas_dia_promedio: number;
}

export interface SugerenciaProveedorGrupo {
  proveedor_id: string | null;
  proveedor_nombre: string;
  productos: SugerenciaLinea[];
}

export interface CatalogoProductoProveedor {
  producto_id: string;
  nombre: string;
  unidad: string;
  stock_actual: number;
  stock_maximo: number;
  precio_unitario: number;
  ventas_dia_promedio: number;
}

async function getContext() {
  const { supabase, userId, empresaId } = await getLogisticaContext();
  return { supabase, user: userId ? { id: userId } : null, empresaId };
}

interface ProductoCompraRow {
  id: string;
  nombre: string;
  unidad: string;
  stock_minimo: number | null;
  stock_maximo: number | null;
  ventas_dia_promedio: number | null;
}

interface StockRow {
  producto_id: string;
  cantidad_actual: number | null;
  cantidad_minima: number | null;
  cantidad_maxima: number | null;
}

interface IngProvRow {
  producto_id: string;
  proveedor_id: string;
  precio_unitario: number | null;
  es_preferido: boolean;
}

interface ProveedorRow {
  id: string;
  nombre_comercial: string;
}

async function fetchBase() {
  const { supabase, empresaId } = await getContext();
  if (!empresaId) return null;

  const [productosRes, stockRes, ingProvRes, proveedoresRes] = await Promise.all([
    supabase
      .from("productos")
      .select("id, nombre, unidad, stock_minimo, stock_maximo, ventas_dia_promedio")
      .eq("empresa_id", empresaId)
      .eq("tipo", "compra")
      .eq("estado", "Activo"),
    supabase
      .from("stock")
      .select("producto_id, cantidad_actual, cantidad_minima, cantidad_maxima")
      .eq("empresa_id", empresaId),
    supabase
      .from("ingredientes_proveedor")
      .select("producto_id, proveedor_id, precio_unitario, es_preferido"),
    supabase
      .from("proveedores")
      .select("id, nombre_comercial")
      .eq("empresa_id", empresaId)
      .eq("estado", "Activo"),
  ]);

  if (productosRes.error) throw productosRes.error;
  if (stockRes.error) throw stockRes.error;
  if (ingProvRes.error) throw ingProvRes.error;
  if (proveedoresRes.error) throw proveedoresRes.error;

  const productos = (productosRes.data ?? []) as ProductoCompraRow[];
  const stock = (stockRes.data ?? []) as StockRow[];
  const ingProv = (ingProvRes.data ?? []) as IngProvRow[];
  const proveedores = (proveedoresRes.data ?? []) as ProveedorRow[];

  const stockByProducto = new Map<string, StockRow>();
  for (const s of stock) stockByProducto.set(s.producto_id, s);

  const proveedorById = new Map<string, ProveedorRow>();
  for (const p of proveedores) proveedorById.set(p.id, p);

  const preferredByProducto = new Map<string, IngProvRow>();
  for (const ip of ingProv) {
    if (ip.es_preferido) preferredByProducto.set(ip.producto_id, ip);
  }
  // fallback: si no hay preferido, usar cualquiera
  for (const ip of ingProv) {
    if (!preferredByProducto.has(ip.producto_id)) {
      preferredByProducto.set(ip.producto_id, ip);
    }
  }

  return {
    productos,
    stockByProducto,
    proveedorById,
    preferredByProducto,
    ingProv,
  };
}

function agruparPorProveedor(
  lineas: SugerenciaLinea[],
  preferredByProducto: Map<string, IngProvRow>,
  proveedorById: Map<string, ProveedorRow>
): SugerenciaProveedorGrupo[] {
  const groups = new Map<string, SugerenciaProveedorGrupo>();

  for (const linea of lineas) {
    const ip = preferredByProducto.get(linea.producto_id);
    const provId = ip?.proveedor_id ?? null;
    const provNombre = provId
      ? proveedorById.get(provId)?.nombre_comercial ?? SIN_PROVEEDOR_LABEL
      : SIN_PROVEEDOR_LABEL;
    const key = provId ?? SIN_PROVEEDOR_ID;

    if (!groups.has(key)) {
      groups.set(key, {
        proveedor_id: provId,
        proveedor_nombre: provNombre,
        productos: [],
      });
    }
    groups.get(key)!.productos.push(linea);
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.proveedor_nombre.localeCompare(b.proveedor_nombre)
  );
}

/**
 * Sugerencias por stock: productos cuyo stock actual está por debajo del stock máximo.
 * Cantidad propuesta = stock_maximo - stock_actual.
 */
export async function getSugerenciasPorStock(): Promise<{
  ok: boolean;
  data: SugerenciaProveedorGrupo[];
}> {
  try {
    const base = await fetchBase();
    if (!base) return { ok: false, data: [] };

    const { productos, stockByProducto, preferredByProducto, proveedorById } = base;

    const lineas: SugerenciaLinea[] = [];
    for (const p of productos) {
      const s = stockByProducto.get(p.id);
      const stockActual = Number(s?.cantidad_actual ?? 0);
      const stockMax = Number(
        s?.cantidad_maxima ?? p.stock_maximo ?? 0
      );
      if (stockMax <= 0) continue;
      if (stockActual >= stockMax) continue;

      const ip = preferredByProducto.get(p.id);
      const necesidad = Math.max(stockMax - stockActual, 0);

      lineas.push({
        producto_id: p.id,
        nombre: p.nombre,
        unidad: p.unidad,
        stock_actual: stockActual,
        stock_maximo: stockMax,
        cantidad_propuesta: Math.ceil(necesidad),
        precio_estimado: Number(ip?.precio_unitario ?? 0),
        ventas_dia_promedio: Number(p.ventas_dia_promedio ?? 0),
      });
    }

    return {
      ok: true,
      data: agruparPorProveedor(lineas, preferredByProducto, proveedorById),
    };
  } catch (err) {
    console.error("[sugerencias] getSugerenciasPorStock:", err);
    return { ok: false, data: [] };
  }
}

/**
 * Sugerencias por ventas: usa ventas_dia_promedio para detectar productos
 * con cobertura insuficiente y propone reposición para alcanzar la cobertura objetivo.
 *
 * Defaults: si stock_actual cubre menos de `diasMinimos` días → sugerir reponer hasta `diasObjetivo` días.
 */
export async function getSugerenciasPorVentas(opts?: {
  diasMinimos?: number;
  diasObjetivo?: number;
}): Promise<{ ok: boolean; data: SugerenciaProveedorGrupo[] }> {
  const diasMinimos = opts?.diasMinimos ?? 7;
  const diasObjetivo = opts?.diasObjetivo ?? 14;

  try {
    const base = await fetchBase();
    if (!base) return { ok: false, data: [] };

    const { productos, stockByProducto, preferredByProducto, proveedorById } = base;

    const lineas: SugerenciaLinea[] = [];
    for (const p of productos) {
      const ventasDia = Number(p.ventas_dia_promedio ?? 0);
      if (ventasDia <= 0) continue;

      const s = stockByProducto.get(p.id);
      const stockActual = Number(s?.cantidad_actual ?? 0);
      const stockMax = Number(s?.cantidad_maxima ?? p.stock_maximo ?? 0);

      const diasCobertura = stockActual / ventasDia;
      if (diasCobertura >= diasMinimos) continue;

      const objetivo = ventasDia * diasObjetivo;
      const necesidad = Math.max(objetivo - stockActual, 0);

      const ip = preferredByProducto.get(p.id);

      lineas.push({
        producto_id: p.id,
        nombre: p.nombre,
        unidad: p.unidad,
        stock_actual: stockActual,
        stock_maximo: stockMax,
        cantidad_propuesta: Math.ceil(necesidad),
        precio_estimado: Number(ip?.precio_unitario ?? 0),
        ventas_dia_promedio: ventasDia,
      });
    }

    return {
      ok: true,
      data: agruparPorProveedor(lineas, preferredByProducto, proveedorById),
    };
  } catch (err) {
    console.error("[sugerencias] getSugerenciasPorVentas:", err);
    return { ok: false, data: [] };
  }
}

/**
 * Devuelve el catálogo de productos que un proveedor ofrece (vía ingredientes_proveedor).
 * Usado para "añadir producto" al pedido sugerido. Si proveedorId es null, devuelve todos
 * los productos compra activos de la empresa.
 */
export async function getCatalogoProveedor(
  proveedorId: string | null
): Promise<{ ok: boolean; data: CatalogoProductoProveedor[] }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [] };

    let productoIds: string[] | null = null;
    const precioByProducto = new Map<string, number>();

    if (proveedorId) {
      const { data: ipRows, error: ipErr } = await supabase
        .from("ingredientes_proveedor")
        .select("producto_id, precio_unitario")
        .eq("proveedor_id", proveedorId);
      if (ipErr) throw ipErr;
      productoIds = (ipRows ?? []).map((r) => r.producto_id as string);
      for (const r of ipRows ?? []) {
        precioByProducto.set(r.producto_id as string, Number(r.precio_unitario ?? 0));
      }
      if (productoIds.length === 0) return { ok: true, data: [] };
    }

    let q = supabase
      .from("productos")
      .select("id, nombre, unidad, stock_maximo, ventas_dia_promedio")
      .eq("empresa_id", empresaId)
      .eq("tipo", "compra")
      .eq("estado", "Activo")
      .order("nombre", { ascending: true });
    if (productoIds) q = q.in("id", productoIds);

    const { data: productos, error: pErr } = await q;
    if (pErr) throw pErr;

    const ids = (productos ?? []).map((p) => p.id as string);
    const stockMap = new Map<string, number>();
    if (ids.length > 0) {
      const { data: stockRows } = await supabase
        .from("stock")
        .select("producto_id, cantidad_actual")
        .eq("empresa_id", empresaId)
        .in("producto_id", ids);
      for (const s of stockRows ?? []) {
        stockMap.set(s.producto_id as string, Number(s.cantidad_actual ?? 0));
      }
    }

    const data: CatalogoProductoProveedor[] = (productos ?? []).map((p) => ({
      producto_id: p.id as string,
      nombre: p.nombre as string,
      unidad: p.unidad as string,
      stock_actual: stockMap.get(p.id as string) ?? 0,
      stock_maximo: Number(p.stock_maximo ?? 0),
      precio_unitario: precioByProducto.get(p.id as string) ?? 0,
      ventas_dia_promedio: Number(p.ventas_dia_promedio ?? 0),
    }));

    return { ok: true, data };
  } catch (err) {
    console.error("[sugerencias] getCatalogoProveedor:", err);
    return { ok: false, data: [] };
  }
}
