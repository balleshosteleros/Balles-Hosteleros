"use server";

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";

export interface PrecioCompraRow {
  id: string;
  producto_id: string;
  precio: number;
  iva: string | null;
  proveedor: string | null;
  formato: string | null;
  fecha_inicio: string; // YYYY-MM-DD
  fecha_fin: string | null; // YYYY-MM-DD | null (indefinido)
  observaciones: string | null;
  created_by: string | null;
  created_at: string;
}

async function getContext() {
  const { supabase, userId, empresaId } = await getLogisticaContext();
  return { supabase, userId, empresaId };
}

/**
 * "Hoy" como "YYYY-MM-DD" en la zona horaria de la empresa (PRP-069), no en UTC
 * del servidor: cerca de medianoche el día UTC puede ir uno por delante/detrás.
 */
function todayIso(tz: string): string {
  return hoyEnZona(tz);
}

function formatPrecioStr(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

function shiftIsoDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Tras añadir/borrar precios, refleja el "vigente" (max fecha_inicio <= hoy y
 * sin haber expirado por fecha_fin) en productos.precio_compra.
 */
async function syncPrecioVigente(
  supabase: Awaited<ReturnType<typeof getContext>>["supabase"],
  productoId: string,
  tz: string
) {
  const today = todayIso(tz);
  const { data } = await supabase
    .from("producto_precios_compra")
    .select("precio, fecha_fin, proveedor, formato")
    .eq("producto_id", productoId)
    .lte("fecha_inicio", today)
    .order("fecha_inicio", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const vigente =
    data && (data.fecha_fin == null || data.fecha_fin >= today) ? data : null;

  await supabase
    .from("productos")
    .update({
      precio_compra:
        vigente != null ? formatPrecioStr(Number(vigente.precio)) : null,
      proveedor: vigente != null ? (vigente.proveedor ?? null) : null,
      formato: vigente != null ? (vigente.formato ?? null) : null,
    })
    .eq("id", productoId);
}

/**
 * Recalcula fecha_fin para cada cadena (proveedor) del producto:
 * cada fila (excepto la más reciente del mismo proveedor) =
 * siguiente.fecha_inicio - 1 día. La fila más reciente de cada proveedor NO se
 * toca (puede tener fecha_fin manual o null).
 */
async function recomputeFechaFin(
  supabase: Awaited<ReturnType<typeof getContext>>["supabase"],
  productoId: string
) {
  const { data, error } = await supabase
    .from("producto_precios_compra")
    .select("id, fecha_inicio, fecha_fin, proveedor")
    .eq("producto_id", productoId)
    .order("fecha_inicio", { ascending: true })
    .order("created_at", { ascending: true });
  if (error || !data) return;

  // Agrupar por proveedor (null se trata como su propia cadena).
  const grupos = new Map<string, typeof data>();
  for (const row of data) {
    const key = (row.proveedor as string | null) ?? "__none__";
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(row);
  }

  for (const filas of grupos.values()) {
    for (let i = 0; i < filas.length - 1; i++) {
      const row = filas[i];
      const next = filas[i + 1];
      const expected = shiftIsoDays(next.fecha_inicio as string, -1);
      if (row.fecha_fin !== expected) {
        await supabase
          .from("producto_precios_compra")
          .update({ fecha_fin: expected })
          .eq("id", row.id);
      }
    }
  }
}

/**
 * Lista todos los precios de compra de un producto, ordenados por fecha_inicio DESC.
 * El primero del array es el más reciente (el "vigente" si su fecha_inicio <= hoy
 * y su fecha_fin no ha pasado).
 */
export async function listPreciosCompra(productoId: string): Promise<{
  ok: boolean;
  data: PrecioCompraRow[];
}> {
  try {
    const { supabase } = await getContext();
    const { data, error } = await supabase
      .from("producto_precios_compra")
      .select("*")
      .eq("producto_id", productoId)
      .order("fecha_inicio", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { ok: true, data: (data ?? []) as PrecioCompraRow[] };
  } catch (err) {
    console.error("[precios-compra] listPreciosCompra:", err);
    return { ok: false, data: [] };
  }
}

export async function addPrecioCompra(input: {
  productoId: string;
  precio: number;
  iva?: string | null;
  proveedor?: string | null;
  formato?: string | null;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin?: string | null; // YYYY-MM-DD | null
  observaciones?: string | null;
}): Promise<{ ok: boolean; error?: string; data?: PrecioCompraRow }> {
  try {
    const { supabase, userId, empresaId } = await getContext();
    if (!userId) return { ok: false, error: "No autenticado" };
    if (!input.productoId) return { ok: false, error: "Producto inválido" };
    const tz = await getZonaHorariaEmpresa(supabase, empresaId);
    if (!Number.isFinite(input.precio) || input.precio < 0) {
      return { ok: false, error: "Precio inválido" };
    }
    if (!input.fechaInicio) return { ok: false, error: "Fecha de inicio inválida" };
    if (input.fechaFin && input.fechaFin < input.fechaInicio) {
      return { ok: false, error: "La fecha hasta no puede ser anterior a la fecha de inicio" };
    }

    // Proveedor es obligatorio y se almacena en MAYÚSCULAS (regla de negocio
    // compartida con `proveedores.nombre_comercial`).
    const proveedorNorm = (input.proveedor ?? "").trim().toUpperCase();
    if (!proveedorNorm) {
      return { ok: false, error: "Selecciona un proveedor para el precio" };
    }

    // Validar contra el último precio del MISMO proveedor: la fecha_inicio debe
    // ser estrictamente posterior. Permite precios paralelos de distintos
    // proveedores.
    const { data: ultimo } = await supabase
      .from("producto_precios_compra")
      .select("fecha_inicio")
      .eq("producto_id", input.productoId)
      .eq("proveedor", proveedorNorm)
      .order("fecha_inicio", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ultimo && input.fechaInicio <= (ultimo.fecha_inicio as string)) {
      return {
        ok: false,
        error: `La fecha de inicio debe ser posterior al último precio del mismo proveedor (${ultimo.fecha_inicio})`,
      };
    }

    const { data, error } = await supabase
      .from("producto_precios_compra")
      .insert({
        producto_id: input.productoId,
        precio: input.precio,
        iva: input.iva ?? null,
        proveedor: proveedorNorm,
        formato: input.formato ?? null,
        fecha_inicio: input.fechaInicio,
        fecha_fin: input.fechaFin ?? null,
        observaciones: input.observaciones ?? null,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;

    // Re-encadenar fecha_fin de los anteriores (por proveedor) para que cierren
    // contra el siguiente del mismo proveedor.
    await recomputeFechaFin(supabase, input.productoId);
    await syncPrecioVigente(supabase, input.productoId, tz);
    return { ok: true, data: data as PrecioCompraRow };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[precios-compra] addPrecioCompra:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Permite editar la fecha_fin del último precio (el más reciente).
 * Pasar `fechaFin = null` lo deja como indefinido.
 * No se permite editar la fecha_fin de filas intermedias (se calcula automáticamente).
 */
export async function updatePrecioCompraFechaFin(input: {
  id: string;
  fechaFin: string | null; // YYYY-MM-DD | null
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    const tz = await getZonaHorariaEmpresa(supabase, empresaId);
    const { data: row, error: e1 } = await supabase
      .from("producto_precios_compra")
      .select("id, producto_id, fecha_inicio, proveedor")
      .eq("id", input.id)
      .maybeSingle();
    if (e1) throw e1;
    if (!row) return { ok: false, error: "Entrada no encontrada" };

    // Comprobar que es el más reciente DEL MISMO PROVEEDOR (no se permite tocar
    // fecha_fin de filas intermedias: se calcula automáticamente).
    const proveedorNorm = (row.proveedor as string | null) ?? null;
    const ultimoQuery = supabase
      .from("producto_precios_compra")
      .select("id")
      .eq("producto_id", row.producto_id as string);
    const { data: ultimo } = await (proveedorNorm == null
      ? ultimoQuery.is("proveedor", null)
      : ultimoQuery.eq("proveedor", proveedorNorm))
      .order("fecha_inicio", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!ultimo || ultimo.id !== row.id) {
      return {
        ok: false,
        error: "Sólo se puede editar la fecha hasta del último precio del proveedor",
      };
    }

    if (input.fechaFin && input.fechaFin < (row.fecha_inicio as string)) {
      return {
        ok: false,
        error: "La fecha hasta no puede ser anterior a la fecha de inicio",
      };
    }

    const { error } = await supabase
      .from("producto_precios_compra")
      .update({ fecha_fin: input.fechaFin })
      .eq("id", input.id);
    if (error) throw error;

    await syncPrecioVigente(supabase, row.producto_id as string, tz);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[precios-compra] updatePrecioCompraFechaFin:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Edita una entrada existente del histórico (cualquier fila, no sólo la última).
 * Permite cambiar precio, iva, proveedor, formato y fecha_inicio. La fecha_fin
 * se sigue gestionando aparte (auto-encadenada para filas intermedias y editable
 * sólo en la última de cada proveedor mediante updatePrecioCompraFechaFin).
 */
export async function updatePrecioCompra(input: {
  id: string;
  precio: number;
  iva?: string | null;
  proveedor: string;
  formato?: string | null;
  fechaInicio: string;
}): Promise<{ ok: boolean; error?: string; data?: PrecioCompraRow }> {
  try {
    const { supabase, empresaId } = await getContext();
    const tz = await getZonaHorariaEmpresa(supabase, empresaId);
    if (!input.id) return { ok: false, error: "Entrada inválida" };
    if (!Number.isFinite(input.precio) || input.precio < 0) {
      return { ok: false, error: "Precio inválido" };
    }
    if (!input.fechaInicio) return { ok: false, error: "Fecha de inicio inválida" };

    const proveedorNorm = (input.proveedor ?? "").trim().toUpperCase();
    if (!proveedorNorm) {
      return { ok: false, error: "Selecciona un proveedor para el precio" };
    }

    const { data: row, error: e1 } = await supabase
      .from("producto_precios_compra")
      .select("id, producto_id")
      .eq("id", input.id)
      .maybeSingle();
    if (e1) throw e1;
    if (!row) return { ok: false, error: "Entrada no encontrada" };

    // Validar que la fecha_inicio no choque con otra entrada del mismo proveedor.
    const { data: gemela } = await supabase
      .from("producto_precios_compra")
      .select("id")
      .eq("producto_id", row.producto_id as string)
      .eq("proveedor", proveedorNorm)
      .eq("fecha_inicio", input.fechaInicio)
      .neq("id", input.id)
      .maybeSingle();

    if (gemela) {
      return {
        ok: false,
        error: "Ya existe un precio del mismo proveedor con esa fecha de inicio",
      };
    }

    const { data, error } = await supabase
      .from("producto_precios_compra")
      .update({
        precio: input.precio,
        iva: input.iva ?? null,
        proveedor: proveedorNorm,
        formato: input.formato ?? null,
        fecha_inicio: input.fechaInicio,
      })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;

    await recomputeFechaFin(supabase, row.producto_id as string);
    await syncPrecioVigente(supabase, row.producto_id as string, tz);
    return { ok: true, data: data as PrecioCompraRow };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[precios-compra] updatePrecioCompra:", msg);
    return { ok: false, error: msg };
  }
}

export async function deletePrecioCompra(id: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const { supabase, empresaId } = await getContext();
    const tz = await getZonaHorariaEmpresa(supabase, empresaId);
    // Recoger producto_id antes de borrar para sincronizar después
    const { data: row } = await supabase
      .from("producto_precios_compra")
      .select("producto_id")
      .eq("id", id)
      .maybeSingle();
    const { error } = await supabase
      .from("producto_precios_compra")
      .delete()
      .eq("id", id);
    if (error) throw error;
    if (row?.producto_id) {
      await recomputeFechaFin(supabase, row.producto_id as string);
      await syncPrecioVigente(supabase, row.producto_id as string, tz);
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[precios-compra] deletePrecioCompra:", msg);
    return { ok: false, error: msg };
  }
}
