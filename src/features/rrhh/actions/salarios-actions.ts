"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import {
  NORMAS_BASE,
  type PuestoSalarial,
  type NormaSalarial,
  type HorarioDia,
} from "@/features/rrhh/data/salarios";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(
    supabase as unknown as SupabaseClient,
    user.id,
  );
  return { supabase, user, empresaId };
}

// Salario embebido dentro de un puesto.
type SalarioEmbed = {
  nomina_neta: number | string | null;
  efectivo_extra: number | string | null;
  salario_neto: number | string | null;
  jornada_contrato: string | null;
  horas_semanales: number | string | null;
  dias_libres: number | null;
  vacaciones: string | null;
  horario_semanal: HorarioDia[] | null;
  observaciones: string | null;
  objetivos: string[] | null;
  estado: "activo" | "borrador" | "inactivo";
  updated_at: string;
};

// Fila puesto-céntrica: el puesto con su salario (LEFT JOIN) y su departamento.
type PuestoRow = {
  id: string; // puestos.id
  nombre: string | null;
  departamentos: { id: string; nombre: string | null } | null;
  puesto_salarios: SalarioEmbed[] | SalarioEmbed | null;
};

function rowToPuesto(r: PuestoRow): PuestoSalarial {
  const sal = Array.isArray(r.puesto_salarios)
    ? r.puesto_salarios[0]
    : r.puesto_salarios;
  return {
    id: r.id, // identificador del PUESTO (clave estable; el upsert es por puesto_id)
    departamento: r.departamentos?.nombre ?? "",
    departamentoId: r.departamentos?.id ?? "",
    puesto: r.nombre ?? "",
    vacaciones: sal?.vacaciones ?? "",
    nominaNeta: Number(sal?.nomina_neta) || 0,
    efectivoExtra: Number(sal?.efectivo_extra) || 0,
    salarioNeto: Number(sal?.salario_neto) || 0,
    jornadaContrato: sal?.jornada_contrato ?? "",
    horasSemanales: Number(sal?.horas_semanales) || 0,
    diasLibres: sal?.dias_libres ?? 0,
    horarioSemanal: sal?.horario_semanal ?? [],
    observaciones: sal?.observaciones ?? "",
    objetivos: sal?.objetivos ?? [],
    estado: sal?.estado ?? "borrador",
    updatedAt: sal?.updated_at?.slice(0, 10) ?? "",
  };
}

/** Puestos (hijos de departamento) con su salario, de la empresa activa. */
export async function listSalariosEmpresa(): Promise<{
  puestos: PuestoSalarial[];
  normas: NormaSalarial[];
}> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { puestos: [], normas: NORMAS_BASE };
    const { data, error } = await supabase
      .from("puestos")
      .select(
        "id, nombre, departamentos(id, nombre), puesto_salarios(nomina_neta, efectivo_extra, salario_neto, jornada_contrato, horas_semanales, dias_libres, vacaciones, horario_semanal, observaciones, objetivos, estado, updated_at)",
      )
      .eq("empresa_id", empresaId);
    if (error) throw error;
    const puestos = ((data ?? []) as unknown as PuestoRow[])
      .map(rowToPuesto)
      .sort((a, b) =>
        a.departamento.localeCompare(b.departamento) ||
        a.puesto.localeCompare(b.puesto),
      );
    return { puestos, normas: NORMAS_BASE };
  } catch (err) {
    console.error("[rrhh] listSalariosEmpresa:", err);
    return { puestos: [], normas: NORMAS_BASE };
  }
}

export interface UpsertSalarioInput {
  id?: string;
  puestoId: string;
  nominaNeta?: number;
  efectivoExtra?: number;
  salarioNeto?: number;
  jornadaContrato?: string;
  horasSemanales?: number;
  diasLibres?: number;
  vacaciones?: string;
  horarioSemanal?: HorarioDia[];
  observaciones?: string;
  objetivos?: string[];
  estado?: "activo" | "borrador" | "inactivo";
}

/** Crea o actualiza el salario (1:1) de un puesto. */
export async function upsertPuestoSalario(input: UpsertSalarioInput) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const payload = {
      empresa_id: empresaId,
      puesto_id: input.puestoId,
      nomina_neta: input.nominaNeta ?? 0,
      efectivo_extra: input.efectivoExtra ?? 0,
      salario_neto: input.salarioNeto ?? 0,
      jornada_contrato: input.jornadaContrato ?? null,
      horas_semanales: input.horasSemanales ?? null,
      dias_libres: input.diasLibres ?? null,
      vacaciones: input.vacaciones ?? null,
      horario_semanal: input.horarioSemanal ?? [],
      observaciones: input.observaciones ?? null,
      objetivos: input.objetivos ?? [],
      estado: input.estado ?? "borrador",
    };
    const { data, error } = await supabase
      .from("puesto_salarios")
      .upsert(payload, { onConflict: "puesto_id" })
      .select("id")
      .single();
    if (error) throw error;
    revalidatePath("/rrhh/salarios");
    return { ok: true, id: data?.id as string };
  } catch (err) {
    console.error("[rrhh] upsertPuestoSalario:", err);
    return { ok: false, error: "No se pudo guardar el salario" };
  }
}

export async function deletePuestoSalario(id: string) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { error } = await supabase
      .from("puesto_salarios")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/rrhh/salarios");
    return { ok: true };
  } catch (err) {
    console.error("[rrhh] deletePuestoSalario:", err);
    return { ok: false, error: "No se pudo eliminar" };
  }
}
