"use server";

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarMovimiento, revertirMovimientosPorDocumento } from "@/features/logistica/services/kardex";

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

    const { data, error } = await supabase
      .from("inventarios")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre,
        fecha: input.fecha ?? new Date().toISOString().slice(0, 10),
        almacen: input.almacen ?? "COCINA",
        motivo: input.motivo ?? input.tipo ?? "periodico",
        estado: "Borrador",
        plantilla_id: input.plantillaId ?? null,
        usuario: input.usuario ?? "",
        notas: input.notas ?? null,
        created_by: user?.id ?? null,
      })
      .select()
      .single();

    // Si falla por columnas no existentes, reintenta con schema mínimo
    if (error) {
      const { data: d2, error: e2 } = await supabase
        .from("inventarios")
        .insert({
          empresa_id: empresaId,
          nombre: input.nombre,
          estado: "Borrador",
          tipo: input.almacen ?? input.tipo ?? "general",
          notas: input.notas ?? null,
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (e2) throw e2;
      return { ok: true, data: d2 };
    }

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

export async function updateInventarioEstado(id: string, estado: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("inventarios")
      .update({ estado, updated_at: new Date().toISOString() })
      .eq("id", id);
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
      .select("empresa_id, nombre")
      .eq("id", inventarioId)
      .maybeSingle();
    if (!inv) return { ok: false, error: "Inventario no encontrado" };
    const empresaId = String(inv.empresa_id); // inventarios.empresa_id es TEXT; stock_movimientos espera UUID
    const referencia = (inv.nombre as string) ?? "Inventario";

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
