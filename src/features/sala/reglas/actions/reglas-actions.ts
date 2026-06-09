"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import {
  type EmpresaReservasRegla,
  type MetricaRegla,
  type ReglaInput,
  type ReglaRow,
  rowToRegla,
  vigenciaToCampos,
} from "../data/reglas";

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
  return { supabase, user, empresaId };
}

function validarInput(input: ReglaInput): string | null {
  if (input.metrica !== "cupo" && input.metrica !== "maxpax") return "Métrica inválida";
  if (input.turno !== "COMIDA" && input.turno !== "CENA" && input.turno !== "AMBOS") return "Turno inválido";
  if (!Number.isFinite(input.valor) || input.valor < 0) return "El valor debe ser un número positivo";
  const { fechaDesde, fechaHasta, diasSemana, fechasExtra } = vigenciaToCampos(input.vigencia);
  if (input.vigencia.modo === "rango") {
    if (!fechaDesde || !fechaHasta) return "Indica fecha desde y fecha hasta";
    if (fechaHasta < fechaDesde) return "La fecha hasta debe ser igual o posterior a la fecha desde";
  }
  if (input.vigencia.modo === "todos_los_dia" && !input.vigencia.diaSemana) {
    return "Indica el día de la semana";
  }
  if (input.vigencia.modo === "fechas" && (!fechasExtra || fechasExtra.length === 0)) {
    return "Añade al menos una fecha";
  }
  if (input.vigencia.modo === "hoy" && (!fechasExtra || fechasExtra.length === 0)) {
    return "No se pudo resolver la fecha de hoy";
  }
  // diasSemana ya validado por vigenciaToCampos vía CHECK constraint en BD.
  void diasSemana;
  return null;
}

export async function listReglasReservas() {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, data: [] as EmpresaReservasRegla[], error: "Sin empresa activa" };
    const { data, error } = await supabase
      .from("empresa_reservas_reglas")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("metrica", { ascending: true })
      .order("prioridad", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { ok: true, data: (data ?? []).map((r) => rowToRegla(r as ReglaRow)) };
  } catch (err) {
    console.error("[reglas] list:", err);
    return { ok: false, data: [] as EmpresaReservasRegla[], error: "No se pudieron cargar las reglas" };
  }
}

export async function createReglaReserva(input: ReglaInput) {
  try {
    const error = validarInput(input);
    if (error) return { ok: false, error };
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "Sin empresa activa" };
    const campos = vigenciaToCampos(input.vigencia);
    const { data, error: dbError } = await supabase
      .from("empresa_reservas_reglas")
      .insert({
        empresa_id: empresaId,
        metrica: input.metrica,
        valor: input.valor,
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
    return { ok: true as const, data: rowToRegla(data as ReglaRow) };
  } catch (err) {
    console.error("[reglas] create:", err);
    return { ok: false, error: "No se pudo crear la regla" };
  }
}

export async function updateReglaReserva(id: string, input: ReglaInput) {
  try {
    const error = validarInput(input);
    if (error) return { ok: false, error };
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "Sin empresa activa" };
    const campos = vigenciaToCampos(input.vigencia);
    const { data, error: dbError } = await supabase
      .from("empresa_reservas_reglas")
      .update({
        metrica: input.metrica,
        valor: input.valor,
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
    return { ok: true as const, data: rowToRegla(data as ReglaRow) };
  } catch (err) {
    console.error("[reglas] update:", err);
    return { ok: false, error: "No se pudo actualizar la regla" };
  }
}

export async function deleteReglaReserva(id: string) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "Sin empresa activa" };
    const { error } = await supabase
      .from("empresa_reservas_reglas")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/sala/reservas");
    return { ok: true as const };
  } catch (err) {
    console.error("[reglas] delete:", err);
    return { ok: false, error: "No se pudo borrar la regla" };
  }
}

/**
 * Atajo server-side: consulta el resolver SQL para una métrica concreta.
 * Útil cuando se necesita el valor efectivo en un único punto sin hidratar
 * todas las reglas (por ejemplo en la validación de creación de reserva).
 */
export async function resolverValorEfectivoServer(
  fechaISO: string,
  turno: "COMIDA" | "CENA",
  metrica: MetricaRegla,
): Promise<number | null> {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return null;
    const { data, error } = await supabase.rpc("resolver_valor_efectivo", {
      p_empresa_id: empresaId,
      p_fecha: fechaISO,
      p_turno: turno,
      p_metrica: metrica,
    });
    if (error) throw error;
    return (data as number | null) ?? null;
  } catch (err) {
    console.error("[reglas] resolverValorEfectivoServer:", err);
    return null;
  }
}

