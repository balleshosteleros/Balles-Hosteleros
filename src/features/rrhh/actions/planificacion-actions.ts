"use server";

// Planificación de horarios (cuadrante visual, solo lectura).
// Resuelve, por LOTE, qué turno tiene cada empleado cada día de un rango,
// combinando la misma lógica que el motor de fichaje
// (src/features/rrhh/utils/horario-empleado.ts):
//   • asignación directa  → rrhh_turno_empleados (vigente_desde ≤ día) y el turno
//     aplica si el día de la semana ∈ turno.dias.
//   • patrón semanal       → rrhh_patron_empleados → rrhh_patron_semanas.dias[weekday].
// Los patrones NO están anclados a fecha: se usa la semana de menor `orden` como
// representativa (misma política conservadora que el motor de fichaje).

import { getAppContext } from "@/lib/supabase/get-context";
import { getEmpleadosActivos } from "@/features/rrhh/actions/empleados-actions";
import type {
  DiaSemana,
  TurnoTono,
  TurnoTramo,
} from "@/features/rrhh/data/horarios";
import { DIAS_SEMANA } from "@/features/rrhh/data/horarios";

type Result<T> = { ok: true; data: T } | { ok: false; data: T; error: string };

export interface PlanTurno {
  id: string;
  codigo: string;
  nombre: string;
  color: TurnoTono;
  tramos: TurnoTramo[];
  dias: DiaSemana[];
  /** Departamento asociado al turno (texto libre), o null si no tiene. */
  departamento: string | null;
}

export interface PlanEmpleado {
  empleadoId: string;
  nombreCompleto: string;
  departamento: string | null;
  /** Área del departamento (operativa/administrativa) para el filtro de ámbito. */
  area: "operativa" | "administrativa";
  puesto: string | null;
  avatarUrl: string | null;
}

export interface PlanPatron {
  id: string;
  nombre: string;
  /** Departamento asociado al patrón (texto libre), o null si no tiene. */
  departamento: string | null;
  /** Semana representativa (orden mínimo): turnoId por día de semana (lunes=0). */
  diasSemana1: (string | null)[];
  empleadosAsignados: number;
}

export type CeldaOrigen = "recurrente" | "manual" | "patron";

export interface TurnoCelda {
  turnoId: string;
  /** Presente solo si viene de rrhh_planificacion (asignación quitable). */
  asignacionId?: string;
  origen: CeldaOrigen;
}

export interface Planificacion {
  empleados: PlanEmpleado[];
  turnos: PlanTurno[];
  patrones: PlanPatron[];
  /** empleadoId → fechaISO → celdas de turno del día. */
  celdas: Record<string, Record<string, TurnoCelda[]>>;
}

const VACIA: Planificacion = {
  empleados: [],
  turnos: [],
  patrones: [],
  celdas: {},
};

async function resolveEmpresaUuid(
  supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"],
  idOrSlug: string,
): Promise<string | null> {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(idOrSlug)) return idOrSlug;
  const { data } = await supabase
    .from("empresas")
    .select("id")
    .eq("slug", idOrSlug)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Días "YYYY-MM-DD" del intervalo [desde, hasta] (ambos inclusive). */
function fechasDelRango(desdeISO: string, hastaISO: string): string[] {
  const out: string[] = [];
  const d = new Date(`${desdeISO}T12:00:00`);
  const fin = new Date(`${hastaISO}T12:00:00`);
  while (d <= fin) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Índice de día con lunes=0 … domingo=6 desde "YYYY-MM-DD" (Madrid-safe). */
function indexLunes(fechaISO: string): number {
  const d = new Date(`${fechaISO}T12:00:00`);
  return (d.getDay() + 6) % 7;
}

/**
 * IDs de empleados dentro del ámbito de un cuadrante (local + departamentos).
 * null = sin filtro de cuadrante.
 */
async function empleadosDelCuadrante(
  supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"],
  empresaId: string,
  cuadranteId: string,
): Promise<Set<string> | null> {
  const { data: cuad } = await supabase
    .from("rrhh_cuadrantes")
    .select("id, local_id")
    .eq("id", cuadranteId)
    .maybeSingle();
  if (!cuad) return null;
  const localId = (cuad.local_id as string | null) ?? null;

  const { data: depRows } = await supabase
    .from("rrhh_cuadrante_departamentos")
    .select("departamento_id")
    .eq("cuadrante_id", cuadranteId);
  const deptIds = new Set((depRows ?? []).map((r) => r.departamento_id as string));
  if (deptIds.size === 0) return new Set();

  const { data: empleadosRows } = await supabase
    .from("empleados")
    .select("id, departamento_id, local_id")
    .eq("empresa_id", empresaId)
    .eq("estado", "Activo");

  const candidatos = (empleadosRows ?? []).filter(
    (e) => e.departamento_id && deptIds.has(e.departamento_id as string),
  );

  if (!localId) return new Set(candidatos.map((e) => e.id as string));

  // Con local: el empleado debe fichar en ese local (puente o por defecto).
  const ids = candidatos.map((e) => e.id as string);
  const localesPorEmpleado = new Map<string, Set<string>>();
  if (ids.length) {
    const { data: locRows } = await supabase
      .from("empleado_locales")
      .select("empleado_id, local_id")
      .in("empleado_id", ids);
    for (const row of locRows ?? []) {
      const empId = row.empleado_id as string;
      const set = localesPorEmpleado.get(empId) ?? new Set<string>();
      set.add(row.local_id as string);
      localesPorEmpleado.set(empId, set);
    }
  }
  return new Set(
    candidatos
      .filter(
        (e) =>
          localesPorEmpleado.get(e.id as string)?.has(localId) ||
          (e.local_id as string | null) === localId,
      )
      .map((e) => e.id as string),
  );
}

export async function getPlanificacionHorarios(
  empresaIdOrSlug: string,
  opts: { desdeISO: string; hastaISO: string; cuadranteId?: string | null },
): Promise<Result<Planificacion>> {
  try {
    const { supabase } = await getAppContext();
    const empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: true, data: VACIA };

    // 1) Empleados activos (dedup multiempresa via fuente única).
    const empleadosRes = await getEmpleadosActivos(empresaIdOrSlug);
    let empleados: PlanEmpleado[] = (empleadosRes.data ?? []).map((e) => ({
      empleadoId: e.empleadoId,
      nombreCompleto: e.nombreCompleto,
      departamento: e.departamento,
      area: e.area,
      puesto: e.puesto,
      avatarUrl: e.avatarUrl,
    }));

    // 1b) Filtro de ámbito por cuadrante (opcional).
    if (opts.cuadranteId) {
      const permitidos = await empleadosDelCuadrante(
        supabase,
        empresaId,
        opts.cuadranteId,
      );
      if (permitidos) {
        empleados = empleados.filter((e) => permitidos.has(e.empleadoId));
      }
    }
    const empleadoIds = empleados.map((e) => e.empleadoId);

    // 2) Catálogo de turnos (oficiales y activos).
    const { data: turnosRows } = await supabase
      .from("rrhh_turnos")
      .select("id, codigo, nombre, color, tramos, dias, departamento")
      .eq("empresa_id", empresaId)
      .eq("es_oficial", true)
      .eq("activo", true);
    const turnos: PlanTurno[] = (turnosRows ?? []).map((t) => ({
      id: t.id as string,
      codigo: (t.codigo as string) ?? "",
      nombre: (t.nombre as string) ?? "",
      color: ((t.color as TurnoTono) ?? "stone") as TurnoTono,
      tramos: (t.tramos as TurnoTramo[]) ?? [],
      dias: (t.dias as DiaSemana[]) ?? [],
      departamento: (t.departamento as string | null) ?? null,
    }));
    const turnoById = new Map(turnos.map((t) => [t.id, t]));

    if (empleadoIds.length === 0) {
      return { ok: true, data: { ...VACIA, turnos } };
    }

    // 3) Asignación directa: empleado → [{turnoId, vigenteDesde}].
    const { data: directosRows } = await supabase
      .from("rrhh_turno_empleados")
      .select("empleado_id, turno_id, vigente_desde")
      .eq("empresa_id", empresaId)
      .in("empleado_id", empleadoIds);
    const directosPorEmpleado = new Map<
      string,
      { turnoId: string; vigenteDesde: string | null }[]
    >();
    for (const row of directosRows ?? []) {
      const empId = row.empleado_id as string;
      const arr = directosPorEmpleado.get(empId) ?? [];
      arr.push({
        turnoId: row.turno_id as string,
        vigenteDesde: (row.vigente_desde as string | null) ?? null,
      });
      directosPorEmpleado.set(empId, arr);
    }

    // 4) Patrones: cadena empleado → patrón → semana representativa.
    const { data: patronesRows } = await supabase
      .from("rrhh_patrones")
      .select("id, nombre, departamento")
      .eq("empresa_id", empresaId)
      .eq("activo", true);
    const patronIds = (patronesRows ?? []).map((p) => p.id as string);

    const semanaRepPorPatron = new Map<string, (string | null)[]>();
    const empleadosPorPatron = new Map<string, string[]>();
    const patronesDeEmpleado = new Map<string, string[]>();

    if (patronIds.length) {
      const [{ data: semanasRows }, { data: asignRows }] = await Promise.all([
        supabase
          .from("rrhh_patron_semanas")
          .select("patron_id, orden, dias")
          .in("patron_id", patronIds)
          .order("orden", { ascending: true }),
        supabase
          .from("rrhh_patron_empleados")
          .select("patron_id, empleado_id")
          .in("patron_id", patronIds),
      ]);

      // Primera semana (orden mínimo) por patrón como representativa.
      for (const s of semanasRows ?? []) {
        const pid = s.patron_id as string;
        if (!semanaRepPorPatron.has(pid)) {
          semanaRepPorPatron.set(pid, (s.dias as (string | null)[]) ?? []);
        }
      }
      for (const a of asignRows ?? []) {
        const pid = a.patron_id as string;
        const empId = a.empleado_id as string;
        const arrE = empleadosPorPatron.get(pid) ?? [];
        arrE.push(empId);
        empleadosPorPatron.set(pid, arrE);
        const arrP = patronesDeEmpleado.get(empId) ?? [];
        arrP.push(pid);
        patronesDeEmpleado.set(empId, arrP);
      }
    }

    const patrones: PlanPatron[] = (patronesRows ?? []).map((p) => {
      const pid = p.id as string;
      return {
        id: pid,
        nombre: (p.nombre as string) ?? "",
        departamento: (p.departamento as string | null) ?? null,
        diasSemana1: semanaRepPorPatron.get(pid) ?? [],
        empleadosAsignados: new Set(empleadosPorPatron.get(pid) ?? []).size,
      };
    });

    // 5) Resolver celdas empleado × día (modelo recurrente).
    //    Map por (empleado → fecha → turnoId → celda) para fusionar luego con
    //    las asignaciones concretas (rrhh_planificacion) sin duplicar turnos.
    const fechas = fechasDelRango(opts.desdeISO, opts.hastaISO);
    const weekdayPorFecha = new Map(fechas.map((f) => [f, indexLunes(f)]));
    const celdasMap: Record<string, Record<string, Map<string, TurnoCelda>>> = {};

    for (const empId of empleadoIds) {
      const directos = directosPorEmpleado.get(empId) ?? [];
      const patronesEmp = patronesDeEmpleado.get(empId) ?? [];
      const porFecha: Record<string, Map<string, TurnoCelda>> = {};

      for (const fecha of fechas) {
        const weekday = weekdayPorFecha.get(fecha)!;
        const letra = DIAS_SEMANA[weekday];
        const map = new Map<string, TurnoCelda>();

        // Directos: vigentes y cuyo turno aplica ese día de la semana.
        // Turnos legacy sin `dias` definidos aplican cada día asignado (como el
        // motor de fichaje, que no filtra por día de la semana en directos).
        for (const d of directos) {
          if (d.vigenteDesde && d.vigenteDesde > fecha) continue;
          const turno = turnoById.get(d.turnoId);
          if (turno && (turno.dias.length === 0 || turno.dias.includes(letra)))
            map.set(d.turnoId, { turnoId: d.turnoId, origen: "recurrente" });
        }
        // Patrones: semana representativa, turno del día de la semana.
        for (const pid of patronesEmp) {
          const dias = semanaRepPorPatron.get(pid);
          const turnoId = dias?.[weekday] ?? null;
          if (turnoId && turnoById.has(turnoId))
            map.set(turnoId, { turnoId, origen: "recurrente" });
        }

        porFecha[fecha] = map;
      }
      celdasMap[empId] = porFecha;
    }

    // 5b) Fusionar asignaciones concretas por día (rrhh_planificacion). Estas
    //     llevan asignacionId → son quitables desde la rejilla y prevalecen.
    const { data: planifRows } = await supabase
      .from("rrhh_planificacion")
      .select("id, empleado_id, fecha, turno_id, origen")
      .eq("empresa_id", empresaId)
      .in("empleado_id", empleadoIds)
      .gte("fecha", opts.desdeISO)
      .lte("fecha", opts.hastaISO);
    for (const row of planifRows ?? []) {
      const turnoId = row.turno_id as string;
      if (!turnoById.has(turnoId)) continue; // turno inactivo/borrado
      const empId = row.empleado_id as string;
      const fecha = row.fecha as string;
      const empMap = (celdasMap[empId] ??= {});
      const map = (empMap[fecha] ??= new Map<string, TurnoCelda>());
      map.set(turnoId, {
        turnoId,
        asignacionId: row.id as string,
        origen: (row.origen as CeldaOrigen) ?? "manual",
      });
    }

    // 5c) Volcar a arrays, omitiendo días sin turnos.
    const celdas: Record<string, Record<string, TurnoCelda[]>> = {};
    for (const [empId, porFecha] of Object.entries(celdasMap)) {
      const out: Record<string, TurnoCelda[]> = {};
      for (const [fecha, map] of Object.entries(porFecha)) {
        if (map.size > 0) out[fecha] = Array.from(map.values());
      }
      celdas[empId] = out;
    }

    return { ok: true, data: { empleados, turnos, patrones, celdas } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[planificacion] getPlanificacionHorarios:", msg);
    return { ok: false, data: VACIA, error: msg };
  }
}
