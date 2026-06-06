"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Cupon,
  CuponBeneficioTipo,
  CuponInput,
  CuponTurno,
  CuponUnidadStock,
} from "@/features/sala/cupones/data/cupones";
import type { DiaSemanaKey } from "@/features/sala/data/reservas";

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(
    supabase as unknown as SupabaseClient,
    user.id,
  );
  return { supabase, user, empresaId };
}

function rowToCupon(row: Record<string, unknown>): Cupon {
  return {
    id: row.id as string,
    empresaId: row.empresa_id as string,
    codigo: row.codigo as string,
    tituloInterno: row.titulo_interno as string,
    tituloCliente: (row.titulo_cliente as string | null) ?? null,
    beneficioTipo: row.beneficio_tipo as CuponBeneficioTipo,
    beneficioValor: (row.beneficio_valor as number | null) ?? null,
    productoDescripcion: (row.producto_descripcion as string | null) ?? null,
    unidadStock: row.unidad_stock as CuponUnidadStock,
    stockTotal: row.stock_total as number,
    stockConsumido: row.stock_consumido as number,
    fechaCaducidad: (row.fecha_caducidad as string | null) ?? null,
    diasSemana: ((row.dias_semana as string[]) ?? []) as DiaSemanaKey[],
    turnos: ((row.turnos as string[]) ?? []) as CuponTurno[],
    activo: (row.activo as boolean) ?? true,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function validarInput(input: CuponInput): string | null {
  if (!input.tituloInterno?.trim()) return "El título interno es obligatorio";
  if (input.tituloInterno.length > 120) return "El título interno no puede pasar de 120 caracteres";
  if (input.tituloCliente && input.tituloCliente.length > 120) {
    return "El título para cliente no puede pasar de 120 caracteres";
  }
  if (input.stockTotal < 1) return "El stock debe ser al menos 1";
  if (input.beneficioTipo === "porcentaje") {
    const v = input.beneficioValor ?? 0;
    if (v < 1 || v > 100) return "El porcentaje debe estar entre 1 y 100";
  } else if (input.beneficioTipo === "importe") {
    const v = input.beneficioValor ?? -1;
    if (v < 0) return "El importe no puede ser negativo";
  } else if (input.beneficioTipo === "producto_gratis") {
    if (!input.productoDescripcion?.trim()) return "Describe el producto regalado";
    if (input.productoDescripcion.length > 200) return "La descripción no puede pasar de 200 caracteres";
  }
  if (input.diasSemana && input.diasSemana.length === 0) return "Selecciona al menos un día";
  if (input.turnos && input.turnos.length === 0) return "Selecciona al menos un turno";
  return null;
}

function inputToRow(input: Partial<CuponInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.tituloInterno !== undefined) row.titulo_interno = input.tituloInterno.trim();
  if (input.tituloCliente !== undefined) {
    row.titulo_cliente = input.tituloCliente?.trim() ? input.tituloCliente.trim() : null;
  }
  if (input.beneficioTipo !== undefined) row.beneficio_tipo = input.beneficioTipo;
  if (input.beneficioValor !== undefined) row.beneficio_valor = input.beneficioValor;
  if (input.productoDescripcion !== undefined) {
    row.producto_descripcion = input.productoDescripcion?.trim() ? input.productoDescripcion.trim() : null;
  }
  if (input.unidadStock !== undefined) row.unidad_stock = input.unidadStock;
  if (input.stockTotal !== undefined) row.stock_total = input.stockTotal;
  if (input.fechaCaducidad !== undefined) row.fecha_caducidad = input.fechaCaducidad || null;
  if (input.diasSemana !== undefined) row.dias_semana = input.diasSemana;
  if (input.turnos !== undefined) row.turnos = input.turnos;
  if (input.activo !== undefined) row.activo = input.activo;
  // Coherencia: limpiar campos que no corresponden al tipo
  if (input.beneficioTipo === "porcentaje" || input.beneficioTipo === "importe") {
    row.producto_descripcion = null;
  }
  if (input.beneficioTipo === "producto_gratis") {
    row.beneficio_valor = null;
  }
  return row;
}

export async function listCuponesAction(): Promise<{ ok: boolean; data: Cupon[]; error?: string }> {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, data: [], error: "No autenticado" };
    const { data, error } = await supabase
      .from("reserva_codigos")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(rowToCupon) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cupones] list:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export async function createCuponAction(
  input: CuponInput,
): Promise<{ ok: boolean; data?: Cupon; error?: string }> {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const err = validarInput(input);
    if (err) return { ok: false, error: err };

    // Generar código único por empresa vía RPC
    const { data: codigoData, error: codigoError } = await supabase.rpc("generar_codigo_cupon", {
      p_empresa_id: empresaId,
    });
    if (codigoError || !codigoData) {
      return { ok: false, error: "No se pudo generar el código" };
    }

    const row = inputToRow(input);
    row.empresa_id = empresaId;
    row.codigo = codigoData;
    // Defaults
    if (input.diasSemana === undefined) row.dias_semana = ["lun","mar","mie","jue","vie","sab","dom"];
    if (input.turnos === undefined) row.turnos = ["COMIDA","CENA"];
    if (input.activo === undefined) row.activo = true;

    const { data, error } = await supabase
      .from("reserva_codigos")
      .insert(row)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/sala/cupones");
    return { ok: true, data: data ? rowToCupon(data) : undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cupones] create:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateCuponAction(
  id: string,
  updates: Partial<CuponInput>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase } = await getCtx();
    // Validación parcial: solo si vienen los campos relevantes
    if (updates.tituloInterno !== undefined ||
        updates.beneficioTipo !== undefined ||
        updates.stockTotal !== undefined ||
        updates.diasSemana !== undefined ||
        updates.turnos !== undefined ||
        updates.beneficioValor !== undefined ||
        updates.productoDescripcion !== undefined) {
      // Cargar fila actual para validar combinación final
      const { data: current } = await supabase
        .from("reserva_codigos")
        .select("*")
        .eq("id", id)
        .single();
      if (!current) return { ok: false, error: "Cupón no encontrado" };
      const merged: CuponInput = {
        tituloInterno: updates.tituloInterno ?? current.titulo_interno,
        tituloCliente: updates.tituloCliente ?? current.titulo_cliente,
        beneficioTipo: updates.beneficioTipo ?? current.beneficio_tipo,
        beneficioValor: updates.beneficioValor ?? current.beneficio_valor,
        productoDescripcion: updates.productoDescripcion ?? current.producto_descripcion,
        unidadStock: updates.unidadStock ?? current.unidad_stock,
        stockTotal: updates.stockTotal ?? current.stock_total,
        fechaCaducidad: updates.fechaCaducidad ?? current.fecha_caducidad,
        diasSemana: updates.diasSemana ?? current.dias_semana,
        turnos: updates.turnos ?? current.turnos,
        activo: updates.activo ?? current.activo,
      };
      const err = validarInput(merged);
      if (err) return { ok: false, error: err };
    }
    const row = inputToRow(updates);
    const { error } = await supabase.from("reserva_codigos").update(row).eq("id", id);
    if (error) throw error;
    revalidatePath("/sala/cupones");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cupones] update:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteCuponAction(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase } = await getCtx();
    const { error } = await supabase.from("reserva_codigos").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/sala/cupones");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cupones] delete:", msg);
    return { ok: false, error: msg };
  }
}

export async function toggleActivoCuponAction(
  id: string,
  activo: boolean,
): Promise<{ ok: boolean; error?: string }> {
  return updateCuponAction(id, { activo });
}
