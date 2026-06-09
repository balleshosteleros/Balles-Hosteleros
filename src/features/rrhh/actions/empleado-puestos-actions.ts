"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { asignarPlantillaPuestoAEmpleado } from "@/features/rrhh/actions/puesto-horario-actions";

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
  return { supabase, user, empresaId };
}

export type PuestoDeEmpleado = {
  puestoId: string;
  nombre: string;
  departamentoId: string | null;
  departamentoNombre: string | null;
  esPrincipal: boolean;
};

/** Puestos que ocupa un empleado (con su departamento), principal primero. */
export async function getPuestosDeEmpleado(empleadoId: string): Promise<PuestoDeEmpleado[]> {
  try {
    const { supabase } = await getContext();
    const { data, error } = await supabase
      .from("empleado_puestos")
      .select("es_principal, puestos(id, nombre, departamento_id, departamentos(nombre))")
      .eq("empleado_id", empleadoId);
    if (error) throw error;
    type Row = {
      es_principal: boolean;
      puestos: { id: string; nombre: string; departamento_id: string | null; departamentos: { nombre: string } | null } | null;
    };
    return ((data ?? []) as unknown as Row[])
      .filter((r) => r.puestos)
      .map((r) => ({
        puestoId: r.puestos!.id,
        nombre: r.puestos!.nombre,
        departamentoId: r.puestos!.departamento_id,
        departamentoNombre: r.puestos!.departamentos?.nombre ?? null,
        esPrincipal: r.es_principal,
      }))
      .sort((a, b) => Number(b.esPrincipal) - Number(a.esPrincipal) || a.nombre.localeCompare(b.nombre));
  } catch (err) {
    console.error("[rrhh] getPuestosDeEmpleado:", err);
    return [];
  }
}

/**
 * Define el conjunto de puestos de un empleado (M:N). Reconcilia altas/bajas:
 * - quita los puestos que ya no estén (y su asignación de horario),
 * - añade los nuevos y les asigna la plantilla vigente del puesto,
 * - marca el principal y propaga departamento + puesto-texto legacy a `empleados`.
 */
export async function setPuestosDeEmpleado(
  empleadoId: string,
  puestoIds: string[],
  principalId: string | null,
  vigenteDesde: string,
) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId || !user) return { ok: false, error: "No autenticado" };

    const nuevos = Array.from(new Set(puestoIds.filter(Boolean)));
    const principal = principalId && nuevos.includes(principalId) ? principalId : nuevos[0] ?? null;

    // Puestos actuales
    const { data: actualesRaw } = await supabase
      .from("empleado_puestos")
      .select("puesto_id")
      .eq("empleado_id", empleadoId);
    const actuales = new Set(((actualesRaw ?? []) as { puesto_id: string }[]).map((r) => r.puesto_id));

    const aQuitar = [...actuales].filter((id) => !nuevos.includes(id));
    const aAnadir = nuevos.filter((id) => !actuales.has(id));

    // 1) Bajas: quitar vínculo + su asignación de horario (patrón oficial del puesto)
    if (aQuitar.length) {
      await supabase.from("empleado_puestos").delete().eq("empleado_id", empleadoId).in("puesto_id", aQuitar);
      const { data: pats } = await supabase
        .from("rrhh_patrones").select("id").in("puesto_id", aQuitar).eq("es_oficial", true);
      const patIds = ((pats ?? []) as { id: string }[]).map((p) => p.id);
      if (patIds.length) {
        await supabase.from("rrhh_patron_empleados").delete().eq("empleado_id", empleadoId).in("patron_id", patIds);
      }
    }

    // 2) Altas: vínculo + asignación de plantilla vigente
    for (const puestoId of aAnadir) {
      const { error: insErr } = await supabase
        .from("empleado_puestos")
        .insert({ empleado_id: empleadoId, puesto_id: puestoId, vigente_desde: vigenteDesde });
      if (insErr) throw insErr;
      await asignarPlantillaPuestoAEmpleado(empleadoId, puestoId, vigenteDesde);
    }

    // 3) Marcar principal (uno solo). Limpiar primero para respetar el índice único parcial.
    await supabase.from("empleado_puestos").update({ es_principal: false }).eq("empleado_id", empleadoId);
    if (principal) {
      await supabase.from("empleado_puestos").update({ es_principal: true })
        .eq("empleado_id", empleadoId).eq("puesto_id", principal);
    }

    // 4) Propagar departamento + puesto-texto del principal a `empleados` (compat)
    if (principal) {
      const { data: p } = await supabase
        .from("puestos").select("nombre, departamento_id").eq("id", principal).maybeSingle();
      if (p) {
        await supabase.from("empleados")
          .update({ puesto: p.nombre as string, departamento_id: p.departamento_id as string | null })
          .eq("id", empleadoId);
      }
    } else {
      await supabase.from("empleados").update({ puesto: null }).eq("id", empleadoId);
    }

    revalidatePath("/rrhh/empleados");
    revalidatePath("/mi-panel");
    return { ok: true };
  } catch (err) {
    console.error("[rrhh] setPuestosDeEmpleado:", err);
    return { ok: false, error: "No se pudieron guardar los puestos del empleado" };
  }
}
