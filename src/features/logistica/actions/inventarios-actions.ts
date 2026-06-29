"use server";

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarMovimiento, revertirMovimientosPorDocumento } from "@/features/logistica/services/kardex";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";

async function getContext() {
  const { supabase, userId, empresaId } = await getLogisticaContext();
  return { supabase, user: userId ? { id: userId } : null, empresaId };
}

export async function listInventarios() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("inventarios")
      .select("*")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[inventarios] listInventarios:", err);
    return { ok: false, data: [] };
  }
}

export async function createInventario(input: {
  nombre: string;
  fecha?: string;
  almacen?: string;
  motivo?: string;
  plantillaId?: string;
  usuario?: string;
  tipo?: string;
  notas?: string;
}) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // PRP-069: el fallback "hoy" se calcula en la zona horaria de la empresa.
    const fechaInventario = input.fecha ?? hoyEnZona(await getZonaHorariaEmpresa(supabase, empresaId));

    const { data, error } = await supabase
      .from("inventarios")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre,
        fecha: fechaInventario,
        almacen: input.almacen ?? null,
        motivo: input.motivo ?? null,
        tipo: input.tipo ?? null,
        estado: "Borrador",
        plantilla_id: input.plantillaId ?? null,
        usuario: input.usuario ?? "",
        notas: input.notas ?? null,
        created_by: user?.id ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[inventarios] createInventario:", msg);
    return { ok: false, error: msg };
  }
}

export async function getInventario(id: string) {
  try {
    const { supabase } = await getContext();
    const { data: inventario, error: invErr } = await supabase
      .from("inventarios")
      .select("*")
      .eq("id", id)
      .single();
    if (invErr) throw invErr;

    const { data: lineas, error: linErr } = await supabase
      .from("lineas_inventario")
      .select("*")
      .eq("inventario_id", id)
      .order("producto_nombre", { ascending: true });

    return { ok: true, data: { ...inventario, lineas: linErr ? [] : (lineas ?? []) } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[inventarios] getInventario:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateInventarioEstado(id: string, estado: string, usuario?: string) {
  try {
    const { supabase } = await getContext();
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { estado, updated_at: now };
    if (estado === "Confirmado") {
      patch.confirmado_at = now;
      patch.confirmado_por = usuario ?? null;
    } else {
      patch.confirmado_at = null;
      patch.confirmado_por = null;
    }
    const { error } = await supabase.from("inventarios").update(patch).eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[inventarios] updateInventarioEstado:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Al CONFIRMAR un inventario (PRP-058): por cada línea con producto_id, ajusta el
 * stock a la cantidad contada (cantidad_real) y registra un movimiento 'inventario'
 * en el kardex. Si la diferencia es 0, registra igualmente un movimiento con cantidad 0
 * ("el inventario no movió nada"). Idempotente: revierte los movimientos previos de
 * este inventario antes de rehacer. Las líneas sin producto_id se omiten.
 */
export async function confirmarInventarioKardex(
  inventarioId: string,
): Promise<{ ok: boolean; ajustados?: number; sinCambio?: number; omitidas?: number; error?: string }> {
  try {
    const { userId } = await getLogisticaContext();
    const admin = createAdminClient();

    const { data: inv } = await admin
      .from("inventarios")
      .select("empresa_id, nombre, fecha")
      .eq("id", inventarioId)
      .maybeSingle();
    if (!inv) return { ok: false, error: "Inventario no encontrado" };
    const empresaId = String(inv.empresa_id); // inventarios.empresa_id es TEXT; stock_movimientos espera UUID
    const referencia = (inv.nombre as string) ?? "Inventario";
    // PRP-069: el movimiento se fecha en el DÍA del documento (mediodía UTC para
    // evitar saltos de día), no en el instante UTC de confirmación. Así un
    // inventario de ayer no se mueve con timestamp de hoy.
    const fechaDoc = (inv.fecha as string | null) ?? null;
    const fechaMovimiento = fechaDoc ? `${fechaDoc}T12:00:00Z` : undefined;

    // Anti-doble: deshacer movimientos previos de este inventario antes de rehacer.
    await revertirMovimientosPorDocumento(
      { empresaId, documentoTipo: "inventario", documentoId: inventarioId },
      admin,
    );

    const { data: lineas } = await admin
      .from("lineas_inventario")
      .select("id, producto_id, cantidad_real")
      .eq("inventario_id", inventarioId);

    let ajustados = 0;
    let sinCambio = 0;
    let omitidas = 0;

    for (const l of (lineas ?? []) as { id: string; producto_id: string | null; cantidad_real: number | null }[]) {
      if (!l.producto_id) {
        omitidas++;
        continue;
      }
      // Saldo actual del producto.
      const { data: st } = await admin
        .from("stock")
        .select("cantidad_actual")
        .eq("empresa_id", empresaId)
        .eq("producto_id", l.producto_id)
        .maybeSingle();
      const saldo = Number(st?.cantidad_actual ?? 0);
      const contado = Number(l.cantidad_real ?? 0);
      const diff = contado - saldo;

      await registrarMovimiento(
        {
          empresaId,
          productoId: l.producto_id,
          tipo: diff >= 0 ? "entrada" : "salida",
          cantidad: Math.abs(diff), // 0 si no hubo cambio → deja constancia igualmente
          referencia,
          documentoTipo: "inventario",
          documentoId: inventarioId,
          origenLineaId: l.id,
          motivo: diff === 0 ? "Inventario sin cambios" : "Ajuste por inventario",
          createdBy: userId ?? null,
          fecha: fechaMovimiento,
        },
        admin,
      );
      if (diff === 0) sinCambio++;
      else ajustados++;
    }

    return { ok: true, ajustados, sinCambio, omitidas };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[inventarios] confirmarInventarioKardex:", msg);
    return { ok: false, error: msg };
  }
}

// ─── Conteos (persistencia de líneas) ─────────────────────────────────────
export interface ConteoInput {
  nombre: string;
  lineas: { productoId: string; producto: string; unidad: string; cantidadReal: number; cantidadTeorica?: number }[];
}

/**
 * Reescribe TODAS las líneas de un inventario a partir de sus conteos.
 * Cada línea guarda el conteo de origen (conteo_nombre) para reconstruir la
 * agrupación al releer. Idempotente: borra y vuelve a insertar.
 */
export async function guardarConteosInventario(inventarioId: string, conteos: ConteoInput[]) {
  try {
    const { supabase } = await getContext();
    const { error: delErr } = await supabase
      .from("lineas_inventario")
      .delete()
      .eq("inventario_id", inventarioId);
    if (delErr) throw delErr;

    const filas: Record<string, unknown>[] = [];
    let orden = 0;
    for (const c of conteos) {
      for (const l of c.lineas) {
        const teorica = l.cantidadTeorica ?? 0;
        filas.push({
          inventario_id: inventarioId,
          conteo_nombre: c.nombre,
          producto_id: l.productoId || null,
          producto_nombre: l.producto,
          unidad: l.unidad,
          cantidad_teorica: teorica,
          cantidad_real: l.cantidadReal,
          diferencia: Math.round((l.cantidadReal - teorica) * 100) / 100,
          orden: orden++,
        });
      }
    }
    if (filas.length > 0) {
      const { error: insErr } = await supabase.from("lineas_inventario").insert(filas);
      if (insErr) throw insErr;
    }
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[inventarios] guardarConteosInventario:", msg);
    return { ok: false, error: msg };
  }
}

/** Reconstruye los conteos (con sus líneas) de un inventario desde la BD. */
export async function getConteosInventario(inventarioId: string) {
  try {
    const { supabase } = await getContext();
    const { data, error } = await supabase
      .from("lineas_inventario")
      .select("*")
      .eq("inventario_id", inventarioId)
      .order("orden", { ascending: true });
    if (error) throw error;

    const grupos = new Map<string, { id: string; nombre: string; lineas: unknown[] }>();
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      const nombre = (r.conteo_nombre as string) || "Conteo";
      if (!grupos.has(nombre)) grupos.set(nombre, { id: `cnt-${nombre}`, nombre, lineas: [] });
      grupos.get(nombre)!.lineas.push({
        productoId: (r.producto_id as string) ?? "",
        producto: (r.producto_nombre as string) ?? "",
        unidad: (r.unidad as string) ?? "ud",
        cantidadReal: Number(r.cantidad_real ?? 0),
        cantidadTeorica: Number(r.cantidad_teorica ?? 0),
      });
    }
    return { ok: true, data: [...grupos.values()] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[inventarios] getConteosInventario:", msg);
    return { ok: false, data: [] as unknown[] };
  }
}

/** Stock real de la empresa para inventarios, con precio de coste por producto. */
export async function getStockInventario() {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [] as Record<string, unknown>[] };

    const [{ data: stock }, { data: productos }] = await Promise.all([
      supabase.from("stock").select("*").eq("empresa_id", empresaId).order("producto_nombre", { ascending: true }),
      supabase.from("productos").select("id, precio_compra, coste").eq("empresa_id", empresaId),
    ]);

    const costeMap = new Map<string, number>();
    for (const p of (productos ?? []) as Array<Record<string, unknown>>) {
      const raw = (p.precio_compra as string) ?? (p.coste as string) ?? "0";
      const num = parseFloat(String(raw).replace(",", "."));
      costeMap.set(p.id as string, Number.isFinite(num) ? num : 0);
    }

    const data = ((stock ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: (r.producto_id as string) ?? (r.id as string),
      nombre: (r.producto_nombre as string) ?? "",
      categoria: "",
      unidad: (r.unidad as string) ?? "ud",
      stockMaximo: Number(r.cantidad_maxima ?? 0),
      stockSeguridad: Number(r.cantidad_minima ?? 0),
      stockActual: Number(r.cantidad_actual ?? 0),
      ultimoInventario: 0,
      ultimoInventarioFecha: null as string | null,
      empresaId,
      precioCoste: costeMap.get((r.producto_id as string) ?? "") ?? 0,
    }));
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[inventarios] getStockInventario:", msg);
    return { ok: false, data: [] as Record<string, unknown>[] };
  }
}

// ─── Tipos de inventario ──────────────────────────────────────────────────
export async function listTiposInventario() {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [] as Record<string, unknown>[] };
    const { data, error } = await supabase
      .from("inventario_tipos")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("nombre", { ascending: true });
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[inventarios] listTiposInventario:", err);
    return { ok: false, data: [] as Record<string, unknown>[] };
  }
}

export async function upsertTipoInventario(input: { id?: string; nombre: string }) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    if (input.id) {
      const { error } = await supabase.from("inventario_tipos").update({ nombre: input.nombre }).eq("id", input.id);
      if (error) throw error;
      return { ok: true, id: input.id };
    }
    const { data, error } = await supabase
      .from("inventario_tipos")
      .insert({ empresa_id: empresaId, nombre: input.nombre })
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: data.id as string };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

export async function deleteTipoInventario(id: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.from("inventario_tipos").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

// ─── Plantillas de inventario ─────────────────────────────────────────────
export async function listPlantillasInventario() {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [] as Record<string, unknown>[] };
    const { data, error } = await supabase
      .from("inventario_plantillas")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("nombre", { ascending: true });
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[inventarios] listPlantillasInventario:", err);
    return { ok: false, data: [] as Record<string, unknown>[] };
  }
}

export async function upsertPlantillaInventario(input: { id?: string; nombre: string; productosIds: string[] }) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    if (input.id) {
      const { error } = await supabase
        .from("inventario_plantillas")
        .update({ nombre: input.nombre, productos_ids: input.productosIds })
        .eq("id", input.id);
      if (error) throw error;
      return { ok: true, id: input.id };
    }
    const { data, error } = await supabase
      .from("inventario_plantillas")
      .insert({ empresa_id: empresaId, nombre: input.nombre, productos_ids: input.productosIds })
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: data.id as string };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

export async function deletePlantillaInventario(id: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.from("inventario_plantillas").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

/** Deshacer la confirmación de un inventario: revierte sus movimientos del kardex. */
export async function revertirInventarioKardex(
  inventarioId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = createAdminClient();
    const { data: inv } = await admin
      .from("inventarios")
      .select("empresa_id")
      .eq("id", inventarioId)
      .maybeSingle();
    if (!inv) return { ok: false, error: "Inventario no encontrado" };
    await revertirMovimientosPorDocumento(
      { empresaId: String(inv.empresa_id), documentoTipo: "inventario", documentoId: inventarioId },
      admin,
    );
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[inventarios] revertirInventarioKardex:", msg);
    return { ok: false, error: msg };
  }
}
