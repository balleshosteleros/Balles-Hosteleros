"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { listTurnos } from "@/features/rrhh/actions/turnos-actions";
import { listPatrones } from "@/features/rrhh/actions/patrones-actions";
import type { Turno } from "@/features/rrhh/data/horarios";

/**
 * Patrón elegible como horario del puesto. Identificado por su FAMILIA (para
 * seguir siempre a la versión oficial vigente) + su semana de turnos para la
 * vista previa.
 */
export type PatronElegible = {
  familiaId: string;
  patronId: string;
  nombre: string;
  dias: (string | null)[];
};

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(
    supabase as unknown as SupabaseClient,
    user.id,
  );
  return { supabase, user, empresaId };
}

const SEMANA_VACIA: (string | null)[] = [null, null, null, null, null, null, null];

function normaDias(raw: unknown): (string | null)[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out = [...SEMANA_VACIA];
  for (let i = 0; i < 7; i++) out[i] = (arr[i] as string | null) ?? null;
  return out;
}

/**
 * Horario del puesto = SELECCIÓN de un patrón del catálogo de Horarios. Devuelve
 * el patrón elegido (por familia), el catálogo de patrones elegibles (oficiales)
 * y los turnos para pintar la vista previa de cada semana.
 *
 * Los patrones elegibles excluyen las plantillas propias de un puesto (legacy,
 * con `puesto_id`): en el modelo nuevo el puesto solo elige patrones creados en
 * Horarios, que son compartibles.
 */
export async function getHorarioPuesto(puestoId: string | null): Promise<{
  familiaSeleccionada: string | null;
  patrones: PatronElegible[];
  turnos: Turno[];
}> {
  const vacio = { familiaSeleccionada: null, patrones: [] as PatronElegible[], turnos: [] as Turno[] };
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return vacio;

    // Sin puesto (al crear uno nuevo) solo se piden los horarios de la empresa:
    // no hay todavía fila de condiciones de la que leer la selección.
    const [turnosRes, patronesRes, salarioRes, familiasPuestoRes] = await Promise.all([
      listTurnos(empresaId),
      listPatrones(empresaId),
      puestoId
        ? supabase
            .from("puesto_salarios")
            .select("patron_familia_id")
            .eq("puesto_id", puestoId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      // Familias de patrones ligados a un puesto (legacy) → se excluyen del selector.
      supabase
        .from("rrhh_patrones")
        .select("familia_id")
        .eq("empresa_id", empresaId)
        .not("puesto_id", "is", null),
    ]);

    const turnos = turnosRes.ok ? turnosRes.data : [];
    const familiasDePuesto = new Set(
      ((familiasPuestoRes.data ?? []) as Array<{ familia_id: string }>).map((r) => r.familia_id),
    );

    const patrones: PatronElegible[] = (patronesRes.ok ? patronesRes.data : [])
      .filter((p) => !familiasDePuesto.has(p.familia_id))
      .map((p) => ({
        familiaId: p.familia_id,
        patronId: p.id,
        nombre: p.nombre,
        dias: normaDias(p.semanas?.[0]?.dias ?? []),
      }));

    const familiaSeleccionada =
      (salarioRes.data?.patron_familia_id as string | null | undefined) ?? null;

    return { familiaSeleccionada, patrones, turnos };
  } catch (err) {
    console.error("[rrhh] getHorarioPuesto:", err);
    return vacio;
  }
}

/**
 * Selecciona (o quita, con null) el patrón de horario del puesto. Fuente única:
 * escribe la familia en `puesto_salarios.patron_familia_id`. Al contratar/vincular
 * un empleado a este puesto, heredará este patrón.
 */
export async function setHorarioPuesto(
  puestoId: string,
  familiaId: string | null,
) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // Debe existir la fila de condiciones del puesto para guardar el horario.
    const { data: fila } = await supabase
      .from("puesto_salarios")
      .select("id")
      .eq("puesto_id", puestoId)
      .maybeSingle();
    if (!fila?.id) {
      return { ok: false, error: "Configura primero las condiciones del puesto antes de asignarle un horario." };
    }

    // Si se selecciona una familia, validar que exista un patrón oficial suyo en la empresa.
    if (familiaId) {
      const { data: oficial } = await supabase
        .from("rrhh_patrones")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("familia_id", familiaId)
        .eq("es_oficial", true)
        .maybeSingle();
      if (!oficial?.id) return { ok: false, error: "El patrón seleccionado ya no está disponible." };
    }

    const { error } = await supabase
      .from("puesto_salarios")
      .update({ patron_familia_id: familiaId })
      .eq("id", fila.id);
    if (error) throw error;

    revalidatePath("/rrhh/puestos");
    return { ok: true };
  } catch (err) {
    console.error("[rrhh] setHorarioPuesto:", err);
    return { ok: false, error: "No se pudo guardar el horario" };
  }
}

/**
 * Resuelve el patrón oficial vigente que aplica al puesto:
 *   1º) el patrón elegido en Horarios (familia guardada en puesto_salarios), o
 *   2º) fallback legacy: una plantilla propia del puesto (rrhh_patrones.puesto_id).
 * Devuelve el id del patrón oficial vigente, o null si el puesto no tiene horario.
 */
async function resolverPatronOficialDelPuesto(
  supabase: Awaited<ReturnType<typeof getContext>>["supabase"],
  empresaId: string,
  puestoId: string,
): Promise<string | null> {
  const { data: salario } = await supabase
    .from("puesto_salarios")
    .select("patron_familia_id")
    .eq("puesto_id", puestoId)
    .maybeSingle();

  const familiaId = (salario?.patron_familia_id as string | null | undefined) ?? null;
  if (familiaId) {
    const { data: oficial } = await supabase
      .from("rrhh_patrones")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("familia_id", familiaId)
      .eq("es_oficial", true)
      .maybeSingle();
    if (oficial?.id) return oficial.id as string;
  }

  // Fallback legacy: plantilla propia del puesto.
  const { data: propio } = await supabase
    .from("rrhh_patrones")
    .select("id")
    .eq("puesto_id", puestoId)
    .eq("es_oficial", true)
    .maybeSingle();
  return (propio?.id as string | undefined) ?? null;
}

/**
 * Asigna el horario del puesto al empleado desde la fecha indicada: lo vincula al
 * patrón oficial vigente que aplica al puesto. Si el puesto no tiene horario, no
 * hace nada (ok).
 *
 * El horario ANTERIOR se cierra el día antes de `vigenteDesde`: a partir de esa
 * fecha manda el nuevo y el viejo deja de generar días. Antes solo se escribía el
 * nuevo, así que el empleado se quedaba con los dos patrones abiertos a la vez y
 * solapados desde ese día.
 */
export async function asignarPlantillaPuestoAEmpleado(
  empleadoId: string,
  puestoId: string,
  vigenteDesde: string,
  // Fin de vigencia de la asignación. null/undefined = ilimitado (se repite hasta
  // que se le ponga fin o se cause baja al empleado).
  vigenteHasta?: string | null,
) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId || !user) return { ok: false, error: "No autenticado" };

    const patronId = await resolverPatronOficialDelPuesto(supabase, empresaId, puestoId);
    if (!patronId) return { ok: true, sinPlantilla: true };

    await cerrarPatronesAnteriores(supabase, empleadoId, patronId, vigenteDesde);

    const { error } = await supabase
      .from("rrhh_patron_empleados")
      .upsert(
        {
          patron_id: patronId,
          empleado_id: empleadoId,
          vigente_desde: vigenteDesde,
          vigente_hasta: vigenteHasta ?? null,
          asignado_por_user_id: user.id,
        },
        { onConflict: "patron_id,empleado_id" },
      );
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.error("[rrhh] asignarPlantillaPuestoAEmpleado:", err);
    return { ok: false, error: "No se pudo asignar la plantilla" };
  }
}

/**
 * Cierra los patrones que el empleado tuviera abiertos (o que terminarían después
 * del relevo) el día ANTES de que entre el nuevo, para que no queden dos horarios
 * solapados. El patrón entrante se excluye: si es el mismo, lo reabre el upsert.
 */
async function cerrarPatronesAnteriores(
  supabase: Awaited<ReturnType<typeof getContext>>["supabase"],
  empleadoId: string,
  patronEntranteId: string,
  vigenteDesde: string,
): Promise<void> {
  const visperaIso = new Date(new Date(`${vigenteDesde}T00:00:00Z`).getTime() - 86_400_000)
    .toISOString()
    .slice(0, 10);

  const { data: abiertos } = await supabase
    .from("rrhh_patron_empleados")
    .select("patron_id, vigente_desde, vigente_hasta")
    .eq("empleado_id", empleadoId)
    .neq("patron_id", patronEntranteId);

  for (const fila of abiertos ?? []) {
    const hasta = (fila.vigente_hasta as string | null) ?? null;
    // Solo estorban los que siguen vivos el día del relevo o después.
    if (hasta && hasta < vigenteDesde) continue;

    const desde = (fila.vigente_desde as string | null) ?? null;
    // Un patrón que aún no había empezado se retira entero: cerrarlo en la
    // víspera dejaría un tramo al revés (fin anterior a su propio inicio).
    if (desde && desde >= vigenteDesde) {
      await supabase
        .from("rrhh_patron_empleados")
        .delete()
        .eq("empleado_id", empleadoId)
        .eq("patron_id", fila.patron_id as string);
      continue;
    }

    await supabase
      .from("rrhh_patron_empleados")
      .update({ vigente_hasta: visperaIso })
      .eq("empleado_id", empleadoId)
      .eq("patron_id", fila.patron_id as string);
  }
}
