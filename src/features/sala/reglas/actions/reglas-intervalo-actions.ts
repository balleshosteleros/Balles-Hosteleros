"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { vigenciaToCampos } from "../data/reglas";
import {
  type EmpresaReservasIntervaloRegla,
  type IntervaloReglaInput,
  type IntervaloReglaRow,
  normalizarHora,
  rowToIntervaloRegla,
} from "../data/reglas-intervalo";

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

function validarInput(input: IntervaloReglaInput): string | null {
  if (input.metrica !== "max_reservas" && input.metrica !== "max_personas") {
    return "Métrica inválida";
  }
  if (input.turno !== "COMIDA" && input.turno !== "CENA" && input.turno !== "AMBOS") {
    return "Turno inválido";
  }
  if (!Number.isFinite(input.valor) || input.valor < 0) {
    return "El valor debe ser un número positivo";
  }
  const hi = normalizarHora(input.horaInicio);
  const hf = normalizarHora(input.horaFin);
  if (!hi || !hf) return "Indica un rango horario válido (HH:MM > HH:MM)";
  if (hi > hf) return "La hora de fin debe ser igual o posterior a la de inicio";

  const { fechaDesde, fechaHasta, fechasExtra } = vigenciaToCampos(input.vigencia);
  if (input.vigencia.modo === "rango") {
    if (!fechaDesde || !fechaHasta) return "Indica fecha desde y fecha hasta";
    if (fechaHasta < fechaDesde) {
      return "La fecha hasta debe ser igual o posterior a la fecha desde";
    }
  }
  if (input.vigencia.modo === "todos_los_dia" && !input.vigencia.diaSemana) {
    return "Indica el día de la semana";
  }
  if (input.vigencia.modo === "fechas" && (!fechasExtra || fechasExtra.length === 0)) {
    return "Añade al menos una fecha";
  }
  return null;
}

export async function listReglasIntervalo() {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) {
      return {
        ok: false,
        data: [] as EmpresaReservasIntervaloRegla[],
        error: "Sin empresa activa",
      };
    }
    const { data, error } = await supabase
      .from("empresa_reservas_intervalo_reglas")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("metrica", { ascending: true })
      .order("hora_inicio", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return {
      ok: true as const,
      data: (data ?? []).map((r) => rowToIntervaloRegla(r as IntervaloReglaRow)),
    };
  } catch (err) {
    console.error("[reglas-intervalo] list:", err);
    return {
      ok: false,
      data: [] as EmpresaReservasIntervaloRegla[],
      error: "No se pudieron cargar las reglas de intervalo",
    };
  }
}

export async function createReglaIntervalo(input: IntervaloReglaInput) {
  try {
    const error = validarInput(input);
    if (error) return { ok: false, error };
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "Sin empresa activa" };
    const campos = vigenciaToCampos(input.vigencia);
    const { data, error: dbError } = await supabase
      .from("empresa_reservas_intervalo_reglas")
      .insert({
        empresa_id: empresaId,
        metrica: input.metrica,
        valor: input.valor,
        hora_inicio: normalizarHora(input.horaInicio)!,
        hora_fin: normalizarHora(input.horaFin)!,
        turno: input.turno,
        fecha_desde: campos.fechaDesde,
        fecha_hasta: campos.fechaHasta,
        dias_semana: campos.diasSemana,
        fechas_extra: campos.fechasExtra,
        nombre: input.nombre ?? null,
        prioridad: input.prioridad ?? 0,
      })
      .select("*")
      .single();
    if (dbError) throw dbError;
    revalidatePath("/sala/reservas");
    return {
      ok: true as const,
      data: rowToIntervaloRegla(data as IntervaloReglaRow),
    };
  } catch (err) {
    console.error("[reglas-intervalo] create:", err);
    return { ok: false, error: "No se pudo crear la regla" };
  }
}

export async function updateReglaIntervalo(id: string, input: IntervaloReglaInput) {
  try {
    const error = validarInput(input);
    if (error) return { ok: false, error };
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "Sin empresa activa" };
    const campos = vigenciaToCampos(input.vigencia);
    const { data, error: dbError } = await supabase
      .from("empresa_reservas_intervalo_reglas")
      .update({
        metrica: input.metrica,
        valor: input.valor,
        hora_inicio: normalizarHora(input.horaInicio)!,
        hora_fin: normalizarHora(input.horaFin)!,
        turno: input.turno,
        fecha_desde: campos.fechaDesde,
        fecha_hasta: campos.fechaHasta,
        dias_semana: campos.diasSemana,
        fechas_extra: campos.fechasExtra,
        nombre: input.nombre ?? null,
        prioridad: input.prioridad ?? 0,
      })
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .select("*")
      .single();
    if (dbError) throw dbError;
    revalidatePath("/sala/reservas");
    return {
      ok: true as const,
      data: rowToIntervaloRegla(data as IntervaloReglaRow),
    };
  } catch (err) {
    console.error("[reglas-intervalo] update:", err);
    return { ok: false, error: "No se pudo actualizar la regla" };
  }
}

export async function deleteReglaIntervalo(id: string) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "Sin empresa activa" };
    const { error } = await supabase
      .from("empresa_reservas_intervalo_reglas")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/sala/reservas");
    return { ok: true as const };
  } catch (err) {
    console.error("[reglas-intervalo] delete:", err);
    return { ok: false, error: "No se pudo borrar la regla" };
  }
}
