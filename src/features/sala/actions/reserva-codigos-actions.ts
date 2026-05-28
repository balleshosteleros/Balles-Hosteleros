"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ReservaCodigo,
  ReservaCodigoTipoPromocion,
  ReservaCodigoTurnos,
  DiaSemanaKey,
} from "@/features/sala/data/reservas";

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

function rowToCodigo(row: Record<string, unknown>): ReservaCodigo {
  return {
    id: row.id as string,
    empresaId: row.empresa_id as string,
    nombre: row.nombre as string,
    descripcion: (row.descripcion as string | null) ?? null,
    tipoPromocion: row.tipo_promocion as ReservaCodigoTipoPromocion,
    minPersonas: (row.min_personas as number) ?? 1,
    maxPersonas: (row.max_personas as number) ?? -1,
    fechaInicio: row.fecha_inicio as string,
    fechaFin: row.fecha_fin as string,
    stockTotal: (row.stock_total as number) ?? 0,
    stockConsumido: (row.stock_consumido as number) ?? 0,
    turnos: row.turnos as ReservaCodigoTurnos,
    restriccionEspecial: (row.restriccion_especial as boolean) ?? false,
    esDescuento: (row.es_descuento as boolean) ?? false,
    porcentajeDescuento: (row.porcentaje_descuento as number | null) ?? null,
    diasSemana: ((row.dias_semana as string[]) ?? []) as DiaSemanaKey[],
    activo: (row.activo as boolean) ?? true,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export interface ReservaCodigoInput {
  nombre: string;
  descripcion?: string | null;
  tipoPromocion: ReservaCodigoTipoPromocion;
  minPersonas: number;
  maxPersonas: number;
  fechaInicio: string;
  fechaFin: string;
  stockTotal: number;
  turnos: ReservaCodigoTurnos;
  restriccionEspecial?: boolean;
  esDescuento?: boolean;
  porcentajeDescuento?: number | null;
  diasSemana?: DiaSemanaKey[];
  activo?: boolean;
}

export async function listReservaCodigos() {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, data: [] as ReservaCodigo[] };
    const { data, error } = await supabase
      .from("reserva_codigos")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(rowToCodigo) };
  } catch (err) {
    console.error("[reserva-codigos] list:", err);
    return { ok: false, data: [] as ReservaCodigo[] };
  }
}

export async function createReservaCodigo(input: ReservaCodigoInput) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    if (!input.nombre.trim()) return { ok: false, error: "El nombre es obligatorio" };
    if (!input.fechaInicio || !input.fechaFin) {
      return { ok: false, error: "Las fechas son obligatorias" };
    }
    const { data, error } = await supabase
      .from("reserva_codigos")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre,
        descripcion: input.descripcion ?? null,
        tipo_promocion: input.tipoPromocion,
        min_personas: input.minPersonas,
        max_personas: input.maxPersonas,
        fecha_inicio: input.fechaInicio,
        fecha_fin: input.fechaFin,
        stock_total: input.stockTotal,
        turnos: input.turnos,
        restriccion_especial: input.restriccionEspecial ?? false,
        es_descuento: input.esDescuento ?? false,
        porcentaje_descuento: input.porcentajeDescuento ?? null,
        dias_semana: input.diasSemana ?? [],
        activo: input.activo ?? true,
      })
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, data: data ? rowToCodigo(data) : null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reserva-codigos] create:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateReservaCodigo(id: string, updates: Partial<ReservaCodigoInput>) {
  try {
    const { supabase } = await getCtx();
    const db: Record<string, unknown> = {};
    if (updates.nombre !== undefined) db.nombre = updates.nombre;
    if (updates.descripcion !== undefined) db.descripcion = updates.descripcion;
    if (updates.tipoPromocion !== undefined) db.tipo_promocion = updates.tipoPromocion;
    if (updates.minPersonas !== undefined) db.min_personas = updates.minPersonas;
    if (updates.maxPersonas !== undefined) db.max_personas = updates.maxPersonas;
    if (updates.fechaInicio !== undefined) db.fecha_inicio = updates.fechaInicio;
    if (updates.fechaFin !== undefined) db.fecha_fin = updates.fechaFin;
    if (updates.stockTotal !== undefined) db.stock_total = updates.stockTotal;
    if (updates.turnos !== undefined) db.turnos = updates.turnos;
    if (updates.restriccionEspecial !== undefined) db.restriccion_especial = updates.restriccionEspecial;
    if (updates.esDescuento !== undefined) db.es_descuento = updates.esDescuento;
    if (updates.porcentajeDescuento !== undefined) db.porcentaje_descuento = updates.porcentajeDescuento;
    if (updates.diasSemana !== undefined) db.dias_semana = updates.diasSemana;
    if (updates.activo !== undefined) db.activo = updates.activo;
    const { error } = await supabase.from("reserva_codigos").update(db).eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reserva-codigos] update:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteReservaCodigo(id: string) {
  try {
    const { supabase } = await getCtx();
    const { error } = await supabase.from("reserva_codigos").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reserva-codigos] delete:", msg);
    return { ok: false, error: msg };
  }
}

