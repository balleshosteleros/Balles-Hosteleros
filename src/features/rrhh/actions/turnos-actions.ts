"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { revalidatePath } from "next/cache";
import { getPatronesQueUsanTurno } from "@/features/rrhh/actions/patrones-actions";
import type {
  Turno,
  TurnoTramo,
  TipoJornada,
  DiaSemana,
} from "@/features/rrhh/data/horarios";
import { COLOR_DEPARTAMENTO_FALLBACK } from "@/features/rrhh/data/horarios";
import { normalizeDeptoNombre } from "@/lib/seeds/departamentos";

// Regla "manda el turno": un turno usado por uno o más patrones no puede
// cambiarse ni borrarse hasta modificar antes esos patrones. Devuelve el
// mensaje de bloqueo, o null si el turno no está en ningún patrón.
async function bloqueoPorPatrones(turnoId: string): Promise<string | null> {
  const res = await getPatronesQueUsanTurno(turnoId);
  if (!res.ok || res.data.length === 0) return null;
  const nombres = res.data.map((p) => `«${p.nombre}»`).join(", ");
  return `Este turno está en uso por ${res.data.length === 1 ? "el patrón" : "los patrones"} ${nombres}. Modifica antes ${res.data.length === 1 ? "ese patrón" : "esos patrones"} y vuelve a intentarlo.`;
}

type Result<T> = { ok: true; data: T } | { ok: false; data: T; error: string };

// Rol base de un turno = su nombre sin el sufijo de día/turno. Permite que un
// mismo código se reparta en varias filas del MISMO rol (p. ej. "JEFE COCINA 1
// LUNES"…"VIERNES" comparten "JC1"), pero detecta cuando un código lo usarían
// roles distintos (colisión real). Debe espejar el regex de la migración
// 20260622150000_rrhh_turnos_codigos_unicos.sql.
function rolBase(nombre: string): string {
  return nombre
    .trim()
    .toUpperCase()
    .replace(
      /\s+(LUNES|MARTES|MIERCOLES|MIÉRCOLES|JUEVES|VIERNES|SABADO|SÁBADO|SABADOS|DOMINGO|DOMINGOS|DIARIO|DIARIA)S?$/,
      "",
    )
    .trim();
}

// Verifica que el código no esté ya en uso por un turno de OTRO rol dentro de la
// misma empresa. Devuelve un mensaje de bloqueo, o null si el código es válido.
// `familiaIdExcluir` evita que un turno choque consigo mismo o con otras filas
// de su propia familia/rol al editarse.
async function colisionDeCodigo(
  supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"],
  empresaId: string,
  codigo: string,
  nombre: string,
  familiaIdExcluir?: string | null,
): Promise<string | null> {
  const cod = codigo.trim().toUpperCase();
  if (!cod) return null;
  const miRol = rolBase(nombre);
  const { data } = await supabase
    .from("rrhh_turnos")
    .select("familia_id, nombre, codigo")
    .eq("empresa_id", empresaId)
    .eq("es_oficial", true);
  for (const r of data ?? []) {
    if ((r.codigo as string | null)?.trim().toUpperCase() !== cod) continue;
    if (familiaIdExcluir && (r.familia_id as string | null) === familiaIdExcluir) continue;
    if (rolBase((r.nombre as string) ?? "") !== miRol) {
      return `El código «${cod}» ya lo usa el turno «${r.nombre}». Cada código debe ser único por turno: elige otro código.`;
    }
  }
  return null;
}

function rowToTurno(r: Record<string, unknown>): Turno {
  return {
    id: r.id as string,
    nombre: r.nombre as string,
    codigo: r.codigo as string,
    tramos: (r.tramos as TurnoTramo[]) ?? [],
    colorHex: COLOR_DEPARTAMENTO_FALLBACK, // se resuelve por departamento en la capa que lista
    activo: !!r.activo,
    centro: (r.centro as string | null) ?? undefined,
    departamento: (r.departamento as string | null) ?? undefined,
    tipoJornada: (r.tipo_jornada as TipoJornada) ?? "fijo",
    dias: (r.dias as DiaSemana[]) ?? [],
    flexHorasDia: r.flex_horas_dia == null ? null : Number(r.flex_horas_dia),
    flexHoras: (r.flex_horas as Partial<Record<DiaSemana, number>>) ?? {},
    familiaId: (r.familia_id as string) ?? (r.id as string),
    version: (r.version as number) ?? 1,
    esOficial: r.es_oficial === undefined ? true : !!r.es_oficial,
    vigenteDesde: (r.vigente_desde as string | null) ?? undefined,
    vigenteHasta: (r.vigente_hasta as string | null) ?? null,
  };
}

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

/** Resuelve el color hex de cada turno a partir del color de su departamento. */
async function aplicarColoresDepartamento(
  supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"],
  empresaId: string,
  turnos: Turno[],
): Promise<Turno[]> {
  if (turnos.length === 0) return turnos;
  const { data: deptRows } = await supabase
    .from("departamentos")
    .select("nombre, color")
    .eq("empresa_id", empresaId);
  const colorPorDepto = new Map<string, string>();
  for (const d of deptRows ?? []) {
    const nombre = (d.nombre as string | null) ?? "";
    if (nombre) {
      colorPorDepto.set(
        normalizeDeptoNombre(nombre),
        (d.color as string | null) || COLOR_DEPARTAMENTO_FALLBACK,
      );
    }
  }
  return turnos.map((t) => ({
    ...t,
    colorHex:
      (t.departamento &&
        colorPorDepto.get(normalizeDeptoNombre(t.departamento))) ||
      COLOR_DEPARTAMENTO_FALLBACK,
  }));
}

export async function listTurnos(empresaIdOrSlug: string): Promise<Result<Turno[]>> {
  try {
    const { supabase } = await getAppContext();
    const empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: true, data: [] };
    // La lista de gestión muestra una fila por familia: la versión oficial.
    // Las versiones anteriores quedan como histórico (getVersionesTurno).
    const { data, error } = await supabase
      .from("rrhh_turnos")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("es_oficial", true)
      .order("nombre", { ascending: true });
    if (error) throw error;
    const turnos = await aplicarColoresDepartamento(
      supabase,
      empresaId,
      (data ?? []).map(rowToTurno),
    );
    return { ok: true, data: turnos };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[turnos] listTurnos:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export type TurnoInput = {
  nombre: string;
  codigo: string;
  tramos: TurnoTramo[];
  departamento?: string | null;
  activo?: boolean;
  tipoJornada?: TipoJornada;
  dias?: DiaSemana[];
  /** Horas/día del flexible (modelo nuevo, sin días). */
  flexHorasDia?: number | null;
  flexHoras?: Partial<Record<DiaSemana, number>>;
  /** Fecha de inicio de validez (YYYY-MM-DD). Por defecto hoy. */
  vigenteDesde?: string;
  /** Fecha de fin de validez (YYYY-MM-DD) o null = sin fecha final. */
  vigenteHasta?: string | null;
};

function makeTurnoId(empresaId: string) {
  return `t-${empresaId.slice(0, 4)}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export async function createTurno(
  empresaIdOrSlug: string,
  input: TurnoInput,
) {
  try {
    const { supabase } = await getAppContext();
    const empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: false, error: "Empresa no encontrada" };

    const colision = await colisionDeCodigo(
      supabase,
      empresaId,
      input.codigo,
      input.nombre,
    );
    if (colision) return { ok: false, error: colision };

    const id = makeTurnoId(empresaId);
    // Un turno nuevo nace como versión 1, oficial, siendo su propia familia.
    const { error } = await supabase.from("rrhh_turnos").insert({
      id,
      empresa_id: empresaId,
      familia_id: id,
      version: 1,
      es_oficial: true,
      vigente_desde: input.vigenteDesde || new Date().toISOString().slice(0, 10),
      vigente_hasta: input.vigenteHasta ?? null,
      nombre: input.nombre.trim(),
      codigo: input.codigo.trim().toUpperCase(),
      tramos: input.tipoJornada === "flexible" ? [] : input.tramos,
      departamento: input.departamento?.trim() || null,
      activo: input.activo ?? true,
      tipo_jornada: input.tipoJornada ?? "fijo",
      dias: input.dias ?? [],
      flex_horas: input.flexHoras ?? {},
      flex_horas_dia: input.flexHorasDia ?? null,
    });
    if (error) throw error;
    revalidatePath("/rrhh/horarios");
    return { ok: true, id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[turnos] createTurno:", msg);
    return { ok: false, error: msg };
  }
}

// Edita metadatos de la versión oficial EN SITIO (nombre, código,
// departamento, activo). El color lo define el departamento, no el turno. El
// HORARIO (tramos) está capado aquí: para cambiarlo hay que crear una versión
// nueva con crearVersionTurno (PRP-053).
export async function updateTurno(id: string, patch: Partial<TurnoInput>) {
  try {
    const { supabase } = await getAppContext();

    // MANDA EL TURNO: si el turno está en un patrón, no se puede cambiar aquí.
    const bloqueo = await bloqueoPorPatrones(id);
    if (bloqueo) return { ok: false, error: bloqueo };

    // Si cambia el código o el nombre, revalidar que no choque con otro rol.
    if (patch.codigo !== undefined || patch.nombre !== undefined) {
      const { data: actual } = await supabase
        .from("rrhh_turnos")
        .select("empresa_id, familia_id, codigo, nombre")
        .eq("id", id)
        .maybeSingle();
      if (actual) {
        const colision = await colisionDeCodigo(
          supabase,
          actual.empresa_id as string,
          patch.codigo ?? (actual.codigo as string),
          patch.nombre ?? (actual.nombre as string),
          (actual.familia_id as string) ?? id,
        );
        if (colision) return { ok: false, error: colision };
      }
    }

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.nombre !== undefined) payload.nombre = patch.nombre.trim();
    if (patch.codigo !== undefined) payload.codigo = patch.codigo.trim().toUpperCase();
    // patch.tramos se ignora deliberadamente: el horario no se edita en sitio.
    if (patch.departamento !== undefined)
      payload.departamento = patch.departamento?.trim() || null;
    if (patch.activo !== undefined) payload.activo = patch.activo;
    // tipo_jornada NO se edita en sitio (no se cambia un fijo a flexible aquí).
    // dias y flex_horas sí: no están versionados, a diferencia de los tramos.
    if (patch.dias !== undefined) payload.dias = patch.dias;
    if (patch.flexHoras !== undefined) payload.flex_horas = patch.flexHoras;
    if (patch.flexHorasDia !== undefined) payload.flex_horas_dia = patch.flexHorasDia;
    // Rango de validez del turno (editable mientras no esté en un patrón).
    if (patch.vigenteDesde !== undefined) payload.vigente_desde = patch.vigenteDesde;
    if (patch.vigenteHasta !== undefined) payload.vigente_hasta = patch.vigenteHasta;
    if (
      payload.vigente_hasta &&
      typeof payload.vigente_hasta === "string" &&
      typeof payload.vigente_desde === "string" &&
      (payload.vigente_hasta as string) < (payload.vigente_desde as string)
    ) {
      return { ok: false, error: "La fecha de fin del turno no puede ser anterior a la de inicio." };
    }

    const { error } = await supabase.from("rrhh_turnos").update(payload).eq("id", id);
    if (error) throw error;
    revalidatePath("/rrhh/horarios");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[turnos] updateTurno:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteTurno(id: string) {
  try {
    const { supabase } = await getAppContext();

    // No se puede borrar un turno que esté en uso por algún patrón.
    const bloqueo = await bloqueoPorPatrones(id);
    if (bloqueo) return { ok: false, error: bloqueo };

    // Tampoco si algún empleado lo tiene/tuvo asignado directamente: la versión
    // debe quedar siempre almacenada como histórico.
    const { count } = await supabase
      .from("rrhh_turno_empleados")
      .select("empleado_id", { count: "exact", head: true })
      .eq("turno_id", id);
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: "No se puede eliminar: hay empleados con este turno asignado. Debe conservarse como histórico.",
      };
    }

    const { error } = await supabase.from("rrhh_turnos").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/rrhh/horarios");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[turnos] deleteTurno:", msg);
    return { ok: false, error: msg };
  }
}

// ─── Versionado de turnos (PRP-053) ─────────────────────────────────────

export type CrearVersionInput = {
  /** id de cualquier versión de la familia (normalmente la oficial mostrada). */
  turnoId: string;
  /** nuevo horario de la versión. */
  tramos: TurnoTramo[];
  /** empleados a los que aplicar el nuevo horario (vacío = a nadie aún). */
  empleadoIds: string[];
  /** fecha desde la que rige el nuevo horario (YYYY-MM-DD). */
  vigenteDesde: string;
};

// Crea una versión nueva del turno (cambia solo el horario), la marca oficial
// y aplica el horario a los empleados elegidos desde la fecha indicada. Todo
// atómico vía la función rrhh_crear_version_turno. Devuelve el id de la versión.
export async function crearVersionTurno(
  empresaIdOrSlug: string,
  input: CrearVersionInput,
) {
  try {
    const { supabase, userId } = await getAppContext();
    const empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: false, error: "Empresa no encontrada" };

    // MANDA EL TURNO: cambiar el horario (nueva versión) también está bloqueado
    // si el turno está en uso por un patrón.
    const bloqueo = await bloqueoPorPatrones(input.turnoId);
    if (bloqueo) return { ok: false, error: bloqueo };

    // Resolver la familia a partir del turno indicado.
    const { data: turnoRow, error: errTurno } = await supabase
      .from("rrhh_turnos")
      .select("familia_id")
      .eq("id", input.turnoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (errTurno) throw errTurno;
    if (!turnoRow?.familia_id) return { ok: false, error: "Turno no encontrado" };

    const nuevoId = makeTurnoId(empresaId);
    const { data, error } = await supabase.rpc("rrhh_crear_version_turno", {
      p_empresa_id: empresaId,
      p_familia_id: turnoRow.familia_id as string,
      p_nuevo_id: nuevoId,
      p_tramos: input.tramos,
      p_vigente_desde: input.vigenteDesde,
      p_empleado_ids: input.empleadoIds.filter(Boolean),
      p_asignado_por: userId,
    });
    if (error) throw error;

    revalidatePath("/rrhh/horarios");
    return { ok: true, id: (data as string) ?? nuevoId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[turnos] crearVersionTurno:", msg);
    return { ok: false, error: msg };
  }
}

// Histórico de versiones de la familia a la que pertenece un turno, de la
// más reciente a la más antigua.
export async function getVersionesTurno(
  empresaIdOrSlug: string,
  turnoId: string,
): Promise<Result<Turno[]>> {
  try {
    const { supabase } = await getAppContext();
    const empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: true, data: [] };

    const { data: turnoRow, error: errTurno } = await supabase
      .from("rrhh_turnos")
      .select("familia_id")
      .eq("id", turnoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (errTurno) throw errTurno;
    if (!turnoRow?.familia_id) return { ok: true, data: [] };

    const { data, error } = await supabase
      .from("rrhh_turnos")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("familia_id", turnoRow.familia_id as string)
      .order("version", { ascending: false });
    if (error) throw error;
    const turnos = await aplicarColoresDepartamento(
      supabase,
      empresaId,
      (data ?? []).map(rowToTurno),
    );
    return { ok: true, data: turnos };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[turnos] getVersionesTurno:", msg);
    return { ok: false, data: [], error: msg };
  }
}

// ─── Asignación DIRECTA turno↔empleado (turnos sueltos) ──────────────────
// Complementa al modelo por patrones. Un empleado que solo trabaja un turno
// concreto se asigna aquí; los multi-turno siguen vía patrón.

export type EmpleadoBasico = {
  id: string;
  nombre: string;
  apellidos: string | null;
};

// Empleados asignados DIRECTAMENTE a cada turno de la empresa.
// Devuelve Record<turnoId, EmpleadoBasico[]>.
export async function getEmpleadosDirectosPorTurno(
  empresaIdOrSlug: string,
): Promise<Result<Record<string, EmpleadoBasico[]>>> {
  try {
    const { supabase } = await getAppContext();
    const empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: true, data: {} };

    const { data, error } = await supabase
      .from("rrhh_turno_empleados")
      .select("turno_id, empleado_id, empleados(id, nombre, apellidos)")
      .eq("empresa_id", empresaId);
    if (error) throw error;

    const acc: Record<string, EmpleadoBasico[]> = {};
    for (const row of data ?? []) {
      const turnoId = row.turno_id as string;
      const empRel = row.empleados as
        | { id: string; nombre: string | null; apellidos: string | null }
        | Array<{ id: string; nombre: string | null; apellidos: string | null }>
        | null;
      const emp = Array.isArray(empRel) ? empRel[0] : empRel;
      if (!emp) continue;
      const arr = acc[turnoId] ?? [];
      arr.push({
        id: emp.id,
        nombre: emp.nombre ?? "",
        apellidos: emp.apellidos ?? null,
      });
      acc[turnoId] = arr;
    }
    for (const turnoId of Object.keys(acc)) {
      acc[turnoId].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    }
    return { ok: true, data: acc };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[turnos] getEmpleadosDirectosPorTurno:", msg);
    return { ok: false, data: {}, error: msg };
  }
}

// Reemplaza el conjunto completo de empleados asignados directamente a un turno.
export async function setEmpleadosDirectosTurno(
  empresaIdOrSlug: string,
  turnoId: string,
  empleadoIds: string[],
) {
  try {
    const { supabase } = await getAppContext();
    const empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: false, error: "Empresa no encontrada" };

    const idsUnicos = Array.from(new Set(empleadoIds.filter(Boolean)));

    // MANDA EL TURNO: no se puede asignar a empleados un turno que hoy está
    // fuera de su rango de validez (aún no empieza o ya terminó).
    if (idsUnicos.length > 0) {
      const hoy = new Date().toISOString().slice(0, 10);
      const { data: turnoRow } = await supabase
        .from("rrhh_turnos")
        .select("nombre, vigente_desde, vigente_hasta")
        .eq("id", turnoId)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (turnoRow) {
        const tDesde = (turnoRow.vigente_desde as string | null) ?? null;
        const tHasta = (turnoRow.vigente_hasta as string | null) ?? null;
        const nombre = (turnoRow.nombre as string) ?? "turno";
        if (tDesde && tDesde > hoy) {
          return { ok: false, error: `El turno «${nombre}» aún no está vigente (empieza el ${tDesde.split("-").reverse().join("/")}). No puedes asignarlo todavía.` };
        }
        if (tHasta && tHasta < hoy) {
          return { ok: false, error: `El turno «${nombre}» ya no está vigente (terminó el ${tHasta.split("-").reverse().join("/")}). Amplía su fecha de fin o usa otro turno.` };
        }
      }
    }

    // Borra los que ya no estén seleccionados.
    const delQuery = supabase
      .from("rrhh_turno_empleados")
      .delete()
      .eq("empresa_id", empresaId)
      .eq("turno_id", turnoId);
    const { error: errDel } = idsUnicos.length
      ? await delQuery.not("empleado_id", "in", `(${idsUnicos.join(",")})`)
      : await delQuery;
    if (errDel) throw errDel;

    // Inserta los nuevos (idempotente vía UNIQUE(turno_id, empleado_id)).
    if (idsUnicos.length) {
      const rows = idsUnicos.map((empleadoId) => ({
        empresa_id: empresaId,
        turno_id: turnoId,
        empleado_id: empleadoId,
      }));
      const { error: errIns } = await supabase
        .from("rrhh_turno_empleados")
        .upsert(rows, { onConflict: "turno_id,empleado_id", ignoreDuplicates: true });
      if (errIns) throw errIns;
    }

    revalidatePath("/rrhh/horarios");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[turnos] setEmpleadosDirectosTurno:", msg);
    return { ok: false, error: msg };
  }
}
