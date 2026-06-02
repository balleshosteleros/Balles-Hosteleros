"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EmpresaReservasHorarioExcepcion,
  HorarioAmbito,
  TurnoKey,
} from "@/features/sala/data/reservas";

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
  return { supabase, user, empresaId };
}

function rowToHorarioExcepcion(row: Record<string, unknown>): EmpresaReservasHorarioExcepcion {
  return {
    id: row.id as string,
    empresaId: row.empresa_id as string,
    turno: row.turno as TurnoKey,
    ambito: row.ambito as HorarioAmbito,
    fecha: (row.fecha as string | null) ?? null,
    fechaInicio: (row.fecha_inicio as string | null) ?? null,
    fechaFin: (row.fecha_fin as string | null) ?? null,
    fechas: (row.fechas as string[] | null) ?? null,
    inicio: (row.inicio as string | null) ?? null,
    fin: (row.fin as string | null) ?? null,
    cerrado: Boolean(row.cerrado),
    motivo: (row.motivo as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listHorariosExcepciones() {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, data: [] as EmpresaReservasHorarioExcepcion[] };
    const { data, error } = await supabase
      .from("empresa_reservas_horarios_excepciones")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(rowToHorarioExcepcion) };
  } catch (err) {
    console.error("[reservas-horarios-excepciones] list:", err);
    return { ok: false, data: [] as EmpresaReservasHorarioExcepcion[] };
  }
}

export interface CrearHorarioExcepcionInput {
  turno: TurnoKey;
  ambito: HorarioAmbito;
  fecha?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  fechas?: string[] | null;
  inicio?: string | null;
  fin?: string | null;
  cerrado: boolean;
  motivo?: string | null;
}

function validarInput(input: CrearHorarioExcepcionInput): string | null {
  if (input.turno !== "comida" && input.turno !== "cena") return "Turno inválido";
  if (!input.cerrado) {
    if (!input.inicio || !input.fin) return "Indica hora de apertura y cierre";
  }
  if (input.ambito === "fecha" && !input.fecha) return "Indica la fecha";
  if (input.ambito === "rango") {
    if (!input.fechaInicio || !input.fechaFin) return "Indica fecha inicio y fin";
    if (input.fechaFin < input.fechaInicio) return "La fecha fin debe ser igual o posterior";
  }
  if (input.ambito === "dias_especificos") {
    if (!input.fechas || input.fechas.length === 0) return "Añade al menos una fecha";
  }
  return null;
}

export async function createHorarioExcepcion(input: CrearHorarioExcepcionInput) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const err = validarInput(input);
    if (err) return { ok: false, error: err };
    const { data, error } = await supabase
      .from("empresa_reservas_horarios_excepciones")
      .insert({
        empresa_id: empresaId,
        turno: input.turno,
        ambito: input.ambito,
        fecha: input.ambito === "fecha" ? input.fecha : null,
        fecha_inicio: input.ambito === "rango" ? input.fechaInicio : null,
        fecha_fin:    input.ambito === "rango" ? input.fechaFin    : null,
        fechas:       input.ambito === "dias_especificos" ? input.fechas : null,
        inicio:  input.cerrado ? null : input.inicio,
        fin:     input.cerrado ? null : input.fin,
        cerrado: input.cerrado,
        motivo:  input.motivo ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, data: data ? rowToHorarioExcepcion(data) : null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reservas-horarios-excepciones] create:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteHorarioExcepcion(id: string) {
  try {
    const { supabase } = await getCtx();
    const { error } = await supabase
      .from("empresa_reservas_horarios_excepciones")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reservas-horarios-excepciones] delete:", msg);
    return { ok: false, error: msg };
  }
}
