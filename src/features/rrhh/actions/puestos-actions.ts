"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import {
  NORMAS_BASE,
  type PuestoSalarial,
  type NivelSalarial,
  type NormaSalarial,
  type HorarioDia,
} from "@/features/rrhh/data/puestos";

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

// Salario embebido dentro de un puesto (una fila por NIVEL).
type SalarioEmbed = {
  nivel: number | null;
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

// Fila puesto-céntrica: el puesto con sus niveles (LEFT JOIN), departamento y gestoría.
type PuestoRow = {
  id: string; // puestos.id
  nombre: string | null;
  departamentos: { id: string; nombre: string | null } | null;
  puesto_salarios: SalarioEmbed[] | SalarioEmbed | null;
  convenio_colectivo: string | null;
  tipo_contrato_defecto: string | null;
  grupo_categoria_prof: string | null;
  epigrafe_cotizacion: string | null;
};

function embedToNivel(sal: SalarioEmbed): NivelSalarial {
  return {
    nivel: sal.nivel ?? 1,
    vacaciones: sal.vacaciones ?? "",
    nominaNeta: Number(sal.nomina_neta) || 0,
    efectivoExtra: Number(sal.efectivo_extra) || 0,
    salarioNeto: Number(sal.salario_neto) || 0,
    jornadaContrato: sal.jornada_contrato ?? "",
    horasSemanales: Number(sal.horas_semanales) || 0,
    diasLibres: sal.dias_libres ?? 0,
    horarioSemanal: sal.horario_semanal ?? [],
    observaciones: sal.observaciones ?? "",
    objetivos: sal.objetivos ?? [],
    estado: sal.estado ?? "borrador",
  };
}

function rowToPuesto(r: PuestoRow, conCronograma: Set<string>): PuestoSalarial {
  const niveles = (Array.isArray(r.puesto_salarios)
    ? r.puesto_salarios
    : r.puesto_salarios ? [r.puesto_salarios] : []
  ).slice().sort((a, b) => (a.nivel ?? 1) - (b.nivel ?? 1));
  // Cabecera = nivel más bajo (normalmente 1).
  const cab = niveles[0];
  return {
    id: r.id, // identificador del PUESTO (clave estable; el upsert es por puesto_id+nivel)
    departamento: r.departamentos?.nombre ?? "",
    departamentoId: r.departamentos?.id ?? "",
    puesto: r.nombre ?? "",
    nivel: cab?.nivel ?? 1,
    nivelesCount: niveles.length || 1,
    vacaciones: cab?.vacaciones ?? "",
    nominaNeta: Number(cab?.nomina_neta) || 0,
    efectivoExtra: Number(cab?.efectivo_extra) || 0,
    salarioNeto: Number(cab?.salario_neto) || 0,
    jornadaContrato: cab?.jornada_contrato ?? "",
    horasSemanales: Number(cab?.horas_semanales) || 0,
    diasLibres: cab?.dias_libres ?? 0,
    horarioSemanal: cab?.horario_semanal ?? [],
    observaciones: cab?.observaciones ?? "",
    objetivos: cab?.objetivos ?? [],
    estado: cab?.estado ?? "borrador",
    updatedAt: cab?.updated_at?.slice(0, 10) ?? "",
    tieneCronograma: conCronograma.has(r.id),
    convenioColectivo: r.convenio_colectivo ?? "",
    tipoContratoDefecto: r.tipo_contrato_defecto ?? "",
    grupoCategoriaProf: r.grupo_categoria_prof ?? "",
    epigrafeCotizacion: r.epigrafe_cotizacion ?? "",
  };
}

/** Puestos (hijos de departamento) con su salario, de la empresa activa. */
export async function listPuestosEmpresa(): Promise<{
  puestos: PuestoSalarial[];
  normas: NormaSalarial[];
}> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { puestos: [], normas: NORMAS_BASE };
    const [{ data, error }, cronosRes] = await Promise.all([
      supabase
        .from("puestos")
        .select(
          "id, nombre, convenio_colectivo, tipo_contrato_defecto, grupo_categoria_prof, epigrafe_cotizacion, departamentos(id, nombre), puesto_salarios(nivel, nomina_neta, efectivo_extra, salario_neto, jornada_contrato, horas_semanales, dias_libres, vacaciones, horario_semanal, observaciones, objetivos, estado, updated_at)",
        )
        .eq("empresa_id", empresaId),
      supabase
        .from("cronogramas_operativos")
        .select("puesto_id")
        .eq("empresa_id", empresaId)
        .not("puesto_id", "is", null),
    ]);
    if (error) throw error;
    const conCronograma = new Set(
      ((cronosRes.data ?? []) as Array<{ puesto_id: string }>).map((c) => c.puesto_id),
    );
    const puestos = ((data ?? []) as unknown as PuestoRow[])
      .map((r) => rowToPuesto(r, conCronograma))
      .sort((a, b) =>
        a.departamento.localeCompare(b.departamento) ||
        a.puesto.localeCompare(b.puesto),
      );
    return { puestos, normas: NORMAS_BASE };
  } catch (err) {
    console.error("[rrhh] listPuestosEmpresa:", err);
    return { puestos: [], normas: NORMAS_BASE };
  }
}

export interface UpsertSalarioInput {
  id?: string;
  puestoId: string;
  /** Nivel del puesto (1..N). Por defecto 1. */
  nivel?: number;
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

/** Crea o actualiza el salario de un NIVEL del puesto (clave: puesto_id + nivel). */
export async function upsertPuestoSalario(input: UpsertSalarioInput) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const payload = {
      empresa_id: empresaId,
      puesto_id: input.puestoId,
      nivel: input.nivel ?? 1,
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
      .upsert(payload, { onConflict: "puesto_id,nivel" })
      .select("id")
      .single();
    if (error) throw error;
    revalidatePath("/rrhh/puestos");
    return { ok: true, id: data?.id as string };
  } catch (err) {
    console.error("[rrhh] upsertPuestoSalario:", err);
    return { ok: false, error: "No se pudo guardar el salario" };
  }
}

/** Lista los niveles (condiciones) de un puesto, ordenados por nivel. */
export async function listNivelesDePuesto(
  puestoId: string,
): Promise<{ ok: boolean; data: NivelSalarial[] }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [] };
    const { data, error } = await supabase
      .from("puesto_salarios")
      .select(
        "nivel, nomina_neta, efectivo_extra, salario_neto, jornada_contrato, horas_semanales, dias_libres, vacaciones, horario_semanal, observaciones, objetivos, estado, updated_at",
      )
      .eq("empresa_id", empresaId)
      .eq("puesto_id", puestoId)
      .order("nivel");
    if (error) throw error;
    const niveles = ((data ?? []) as unknown as SalarioEmbed[]).map(embedToNivel);
    return { ok: true, data: niveles };
  } catch (err) {
    console.error("[rrhh] listNivelesDePuesto:", err);
    return { ok: false, data: [] };
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
    revalidatePath("/rrhh/puestos");
    return { ok: true };
  } catch (err) {
    console.error("[rrhh] deletePuestoSalario:", err);
    return { ok: false, error: "No se pudo eliminar" };
  }
}
