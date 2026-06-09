"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import type { TipoJornada } from "@/features/rrhh/data/horarios";

export type PatronTipo = "semanal" | "libre";

/** Máximo de periodos (semanas) por patrón. */
const MAX_SEMANAS_PATRON = 5;

export type PatronRow = {
  id: string;
  empresa_id: string;
  nombre: string;
  tipo: PatronTipo;
  /** Jornada del patrón: todos sus turnos son de este tipo (fijo o flexible). */
  tipo_jornada: TipoJornada;
  /** Departamento al que pertenece el patrón (nombre), o null si sin asignar. */
  departamento: string | null;
  creado_por_user_id: string | null;
  creado_por_nombre: string;
  activo: boolean;
  /** Fecha de inicio de validez (YYYY-MM-DD). Por defecto el día de alta. */
  vigente_desde: string;
  /** Fecha de fin de validez (YYYY-MM-DD) o null = sin fecha final. */
  vigente_hasta: string | null;
  /** Versionado: cada patrón es una versión de una familia. */
  familia_id: string;
  version: number;
  es_oficial: boolean;
  created_at: string;
  updated_at: string;
};

export type PatronSemanaRow = {
  id: string;
  patron_id: string;
  orden: number;
  dias: (string | null)[];
  created_at: string;
};

export type PatronCompleto = PatronRow & {
  semanas: { orden: number; dias: (string | null)[] }[];
  empleadosAsignados: number;
};

export type PatronInput = {
  nombre: string;
  tipo: PatronTipo;
  /** Jornada del patrón. Por defecto "fijo" (default en BD). */
  tipo_jornada?: TipoJornada;
  /** Departamento al que pertenece el patrón (nombre). null/"" = sin asignar. */
  departamento?: string | null;
  semanas: { orden: number; dias: (string | null)[] }[];
  activo?: boolean;
  /** YYYY-MM-DD. Si no se indica, se usa el día actual (default en BD). */
  vigente_desde?: string;
  /** YYYY-MM-DD o null = sin fecha final. */
  vigente_hasta?: string | null;
};

export type EmpleadoBasico = {
  id: string;
  nombre: string;
  apellidos: string | null;
};

function hoyISODate(): string {
  return new Date().toISOString().split("T")[0];
}

function fmtFecha(iso: string): string {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

// Regla: MANDA EL TURNO. Un patrón solo puede abarcar fechas en las que TODOS
// sus turnos estén vigentes. Devuelve un mensaje de error si algún turno no
// cubre por completo el rango [desde, hasta] del patrón; null si todo correcto.
async function validarTurnosCubrenPatron(
  supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"],
  empresaId: string,
  turnoIds: string[],
  desde: string,
  hasta: string | null,
): Promise<string | null> {
  const ids = Array.from(new Set(turnoIds.filter(Boolean)));
  if (ids.length === 0) return null;

  const { data: turnos, error } = await supabase
    .from("rrhh_turnos")
    .select("id, nombre, vigente_desde, vigente_hasta")
    .eq("empresa_id", empresaId)
    .in("id", ids);
  if (error) throw error;

  for (const t of turnos ?? []) {
    const nombre = (t.nombre as string) ?? "turno";
    const tDesde = (t.vigente_desde as string | null) ?? null;
    const tHasta = (t.vigente_hasta as string | null) ?? null;

    if (tDesde && tDesde > desde) {
      return `El turno «${nombre}» empieza el ${fmtFecha(tDesde)}, después del inicio del patrón (${fmtFecha(desde)}). Retrasa el inicio del patrón hasta el ${fmtFecha(tDesde)} o adelanta el del turno.`;
    }
    if (tHasta) {
      if (hasta === null) {
        return `El turno «${nombre}» termina el ${fmtFecha(tHasta)}, pero el patrón no tiene fecha de fin. Pon una fecha de fin al patrón (no posterior al ${fmtFecha(tHasta)}) o amplía la del turno.`;
      }
      if (tHasta < hasta) {
        return `El turno «${nombre}» termina el ${fmtFecha(tHasta)}, antes del fin del patrón (${fmtFecha(hasta)}). Recorta la fecha de fin del patrón hasta el ${fmtFecha(tHasta)} o amplía la del turno.`;
      }
    }
  }
  return null;
}

// Regla "patrón de un solo tipo": todas las celdas del patrón deben referenciar
// turnos cuyo tipo_jornada coincida con el del patrón. Evita mezclar fijo y
// flexible en el mismo patrón. Devuelve un mensaje de error o null si todo ok.
async function validarTurnosMismaJornada(
  supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"],
  empresaId: string,
  turnoIds: string[],
  jornadaPatron: TipoJornada,
): Promise<string | null> {
  const ids = Array.from(new Set(turnoIds.filter(Boolean)));
  if (ids.length === 0) return null;

  const { data: turnos, error } = await supabase
    .from("rrhh_turnos")
    .select("id, nombre, tipo_jornada")
    .eq("empresa_id", empresaId)
    .in("id", ids);
  if (error) throw error;

  const etiqueta = (j: TipoJornada) => (j === "flexible" ? "flexible" : "fija");
  for (const t of turnos ?? []) {
    const jornadaTurno = ((t.tipo_jornada as TipoJornada | null) ?? "fijo");
    if (jornadaTurno !== jornadaPatron) {
      const nombre = (t.nombre as string) ?? "turno";
      return `El turno «${nombre}» es de jornada ${etiqueta(jornadaTurno)} y este patrón es de jornada ${etiqueta(jornadaPatron)}. Un patrón solo admite turnos del mismo tipo de jornada.`;
    }
  }
  return null;
}

// Empleados asignados a cada turno y descanso vía patrones.
// Cadena: empleado → patrón (rrhh_patron_empleados) → semanas (rrhh_patron_semanas.dias) → turno_id.
// Para descansos se obtiene en cliente uniendo los empleados de descanso.turnos[].
// Si se pasa empresaIdOrSlug filtra por esa empresa concreta; si no, usa la
// empresa del profile.
export async function getEmpleadosPorTurno(empresaIdOrSlug?: string) {
  try {
    const { supabase, empresaId: empresaIdProfile } = await getAppContext();
    let empresaId = empresaIdProfile;
    if (empresaIdOrSlug) {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(empresaIdOrSlug)) {
        empresaId = empresaIdOrSlug;
      } else {
        const { data } = await supabase
          .from("empresas")
          .select("id")
          .eq("slug", empresaIdOrSlug)
          .maybeSingle();
        empresaId = (data?.id as string | undefined) ?? null;
      }
    }
    if (!empresaId)
      return {
        ok: false,
        data: {} as Record<string, EmpleadoBasico[]>,
        error: "Empresa no encontrada",
      };

    const { data: patrones, error: errP } = await supabase
      .from("rrhh_patrones")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("activo", true);
    if (errP) throw errP;

    const patronIds = (patrones ?? []).map((p) => p.id as string);
    if (patronIds.length === 0)
      return { ok: true, data: {} as Record<string, EmpleadoBasico[]> };

    const [semanasRes, asignacionesRes] = await Promise.all([
      supabase
        .from("rrhh_patron_semanas")
        .select("patron_id, dias")
        .in("patron_id", patronIds),
      supabase
        .from("rrhh_patron_empleados")
        .select("patron_id, empleado_id")
        .in("patron_id", patronIds),
    ]);
    if (semanasRes.error) throw semanasRes.error;
    if (asignacionesRes.error) throw asignacionesRes.error;

    const empleadoIds = Array.from(
      new Set((asignacionesRes.data ?? []).map((a) => a.empleado_id as string)),
    );
    if (empleadoIds.length === 0)
      return { ok: true, data: {} as Record<string, EmpleadoBasico[]> };

    const { data: empleados, error: errE } = await supabase
      .from("empleados")
      .select("id, nombre, apellidos")
      .in("id", empleadoIds);
    if (errE) throw errE;

    const empleadoById = new Map<string, EmpleadoBasico>();
    for (const e of empleados ?? []) {
      empleadoById.set(e.id as string, {
        id: e.id as string,
        nombre: (e.nombre as string) ?? "",
        apellidos: (e.apellidos as string | null) ?? null,
      });
    }

    const empleadosByPatron = new Map<string, EmpleadoBasico[]>();
    for (const a of asignacionesRes.data ?? []) {
      const emp = empleadoById.get(a.empleado_id as string);
      if (!emp) continue;
      const arr = empleadosByPatron.get(a.patron_id as string) ?? [];
      arr.push(emp);
      empleadosByPatron.set(a.patron_id as string, arr);
    }

    const acc = new Map<string, Map<string, EmpleadoBasico>>();
    for (const s of semanasRes.data ?? []) {
      const empleadosPatron =
        empleadosByPatron.get(s.patron_id as string) ?? [];
      if (empleadosPatron.length === 0) continue;
      const dias = (s.dias ?? []) as (string | null)[];
      for (const turnoId of dias) {
        if (!turnoId) continue;
        let mapTurno = acc.get(turnoId);
        if (!mapTurno) {
          mapTurno = new Map();
          acc.set(turnoId, mapTurno);
        }
        for (const e of empleadosPatron) mapTurno.set(e.id, e);
      }
    }

    const data: Record<string, EmpleadoBasico[]> = {};
    for (const [turnoId, map] of acc.entries()) {
      data[turnoId] = Array.from(map.values()).sort((a, b) =>
        a.nombre.localeCompare(b.nombre),
      );
    }
    return { ok: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[patrones] getEmpleadosPorTurno:", msg);
    return {
      ok: false,
      data: {} as Record<string, EmpleadoBasico[]>,
      error: msg,
    };
  }
}

// ─── Turno usado por patrones (para bloquear su edición) ────────────────────
// Regla: si un turno está dentro de algún patrón, NO debe poder cambiarse hasta
// que se modifique antes el patrón. Esta función devuelve los patrones que usan
// el turno; la pantalla/acción de edición de turnos debe llamarla y bloquear si
// `data.length > 0`. (Listo aquí porque la edición de turnos está en reescritura.)
export async function getPatronesQueUsanTurno(
  turnoId: string,
): Promise<{ ok: boolean; data: { id: string; nombre: string }[]; error?: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, data: [], error: "No autenticado" };

    const { data: patrones } = await supabase
      .from("rrhh_patrones")
      .select("id, nombre")
      .eq("empresa_id", empresaId);
    const ids = (patrones ?? []).map((p) => p.id as string);
    if (ids.length === 0) return { ok: true, data: [] };

    const { data: sem } = await supabase
      .from("rrhh_patron_semanas")
      .select("patron_id, dias")
      .in("patron_id", ids);

    const usados = new Set<string>();
    for (const s of sem ?? []) {
      const dias = (s.dias ?? []) as (string | null)[];
      if (dias.some((d) => d === turnoId)) usados.add(s.patron_id as string);
    }
    const nombreById = new Map((patrones ?? []).map((p) => [p.id as string, (p.nombre as string) ?? ""]));
    return {
      ok: true,
      data: Array.from(usados).map((id) => ({ id, nombre: nombreById.get(id) ?? "" })),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[patrones] getPatronesQueUsanTurno:", msg);
    return { ok: false, data: [], error: msg };
  }
}

// ─── LIST ──────────────────────────────────────────────────────────────
export async function listPatrones(empresaIdOrSlug?: string) {
  try {
    const { supabase, empresaId: empresaIdProfile } = await getAppContext();
    let empresaId = empresaIdProfile;
    if (empresaIdOrSlug) {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(empresaIdOrSlug)) {
        empresaId = empresaIdOrSlug;
      } else {
        const { data } = await supabase
          .from("empresas")
          .select("id")
          .eq("slug", empresaIdOrSlug)
          .maybeSingle();
        empresaId = (data?.id as string | undefined) ?? null;
      }
    }
    if (!empresaId)
      return { ok: false, data: [] as PatronCompleto[], error: "Empresa no encontrada" };

    const { data: patrones, error: errP } = await supabase
      .from("rrhh_patrones")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("es_oficial", true) // la lista muestra siempre la última versión
      .order("nombre", { ascending: true });
    if (errP) throw errP;

    const ids = (patrones ?? []).map((p) => p.id as string);
    if (ids.length === 0) return { ok: true, data: [] as PatronCompleto[] };

    const [semanasRes, asignacionesRes] = await Promise.all([
      supabase
        .from("rrhh_patron_semanas")
        .select("patron_id, orden, dias")
        .in("patron_id", ids)
        .order("orden", { ascending: true }),
      supabase
        .from("rrhh_patron_empleados")
        .select("patron_id")
        .in("patron_id", ids),
    ]);

    if (semanasRes.error) throw semanasRes.error;
    if (asignacionesRes.error) throw asignacionesRes.error;

    const semanasByPatron = new Map<
      string,
      { orden: number; dias: (string | null)[] }[]
    >();
    for (const s of semanasRes.data ?? []) {
      const arr = semanasByPatron.get(s.patron_id as string) ?? [];
      arr.push({ orden: s.orden as number, dias: s.dias as (string | null)[] });
      semanasByPatron.set(s.patron_id as string, arr);
    }

    const countByPatron = new Map<string, number>();
    for (const a of asignacionesRes.data ?? []) {
      const pid = a.patron_id as string;
      countByPatron.set(pid, (countByPatron.get(pid) ?? 0) + 1);
    }

    const data: PatronCompleto[] = (patrones ?? []).map((p) => ({
      ...(p as PatronRow),
      semanas: semanasByPatron.get(p.id as string) ?? [],
      empleadosAsignados: countByPatron.get(p.id as string) ?? 0,
    }));

    return { ok: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[patrones] listPatrones:", msg);
    return { ok: false, data: [] as PatronCompleto[], error: msg };
  }
}

// ─── CREATE ────────────────────────────────────────────────────────────
export async function createPatron(
  input: PatronInput,
  empresaIdOrSlug?: string,
) {
  try {
    const { supabase, empresaId: empresaIdProfile, userId } = await getAppContext();
    let empresaId = empresaIdProfile;
    if (empresaIdOrSlug) {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(empresaIdOrSlug)) {
        empresaId = empresaIdOrSlug;
      } else {
        const { data } = await supabase
          .from("empresas")
          .select("id")
          .eq("slug", empresaIdOrSlug)
          .maybeSingle();
        empresaId = (data?.id as string | undefined) ?? null;
      }
    }
    if (!empresaId || !userId)
      return { ok: false, error: "No autenticado o empresa no encontrada" };

    const nombre = input.nombre.trim();
    if (!nombre) return { ok: false, error: "El nombre es obligatorio" };
    if (input.semanas.length > MAX_SEMANAS_PATRON) {
      return { ok: false, error: `Un patrón admite como máximo ${MAX_SEMANAS_PATRON} periodos (semanas).` };
    }

    // MANDA EL TURNO: todos los turnos del patrón deben cubrir su vigencia.
    const desde = input.vigente_desde || hoyISODate();
    const hasta = input.vigente_hasta ?? null;
    if (hasta && hasta < desde) {
      return { ok: false, error: "La fecha de fin del patrón no puede ser anterior a la de inicio." };
    }
    const turnoIdsCreate = input.semanas.flatMap((s) =>
      s.dias.filter((d): d is string => Boolean(d)),
    );
    const errCobertura = await validarTurnosCubrenPatron(
      supabase,
      empresaId,
      turnoIdsCreate,
      desde,
      hasta,
    );
    if (errCobertura) return { ok: false, error: errCobertura };

    // Patrón de un solo tipo: turnos del patrón deben ser de su misma jornada.
    const jornadaPatron = input.tipo_jornada ?? "fijo";
    const errJornada = await validarTurnosMismaJornada(
      supabase,
      empresaId,
      turnoIdsCreate,
      jornadaPatron,
    );
    if (errJornada) return { ok: false, error: errJornada };

    // Snapshot del nombre del usuario en este momento (no cambia si se da de baja).
    const { data: profile } = await supabase
      .from("usuarios")
      .select("nombre, apellidos")
      .eq("user_id", userId)
      .single();

    const creadorNombre = [profile?.nombre, profile?.apellidos]
      .filter(Boolean)
      .join(" ")
      .trim() || "Usuario";

    const { data: patron, error } = await supabase
      .from("rrhh_patrones")
      .insert({
        empresa_id: empresaId,
        nombre,
        tipo: input.tipo,
        tipo_jornada: input.tipo_jornada ?? "fijo",
        departamento: input.departamento?.trim() || null,
        creado_por_user_id: userId,
        creado_por_nombre: creadorNombre,
        activo: input.activo ?? true,
        ...(input.vigente_desde ? { vigente_desde: input.vigente_desde } : {}),
        vigente_hasta: input.vigente_hasta ?? null,
      })
      .select()
      .single();
    if (error) throw error;

    if (input.semanas.length > 0) {
      const rows = input.semanas.map((s) => ({
        patron_id: patron.id as string,
        orden: s.orden,
        dias: s.dias,
      }));
      const { error: errS } = await supabase
        .from("rrhh_patron_semanas")
        .insert(rows);
      if (errS) throw errS;
    }

    return { ok: true, data: patron as PatronRow };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[patrones] createPatron:", msg);
    return { ok: false, error: msg };
  }
}

// ─── UPDATE ────────────────────────────────────────────────────────────
export async function updatePatron(
  id: string,
  input: Partial<Pick<PatronInput, "nombre" | "activo" | "vigente_desde" | "vigente_hasta">> & {
    semanas?: { orden: number; dias: (string | null)[] }[];
  }
) {
  try {
    const { supabase } = await getAppContext();

    if (input.semanas && input.semanas.length > MAX_SEMANAS_PATRON) {
      return { ok: false, error: `Un patrón admite como máximo ${MAX_SEMANAS_PATRON} periodos (semanas).` };
    }

    // MANDA EL TURNO: si cambian las fechas del patrón o sus turnos, validar que
    // todos los turnos cubran la vigencia resultante.
    const needsValidation =
      input.vigente_desde !== undefined ||
      input.vigente_hasta !== undefined ||
      input.semanas !== undefined;
    if (needsValidation) {
      const { data: pat, error: ePat } = await supabase
        .from("rrhh_patrones")
        .select("empresa_id, vigente_desde, vigente_hasta, tipo_jornada")
        .eq("id", id)
        .single();
      if (ePat) throw ePat;

      const desde = input.vigente_desde ?? (pat.vigente_desde as string);
      const hasta =
        input.vigente_hasta !== undefined
          ? input.vigente_hasta
          : (pat.vigente_hasta as string | null);
      if (hasta && hasta < desde) {
        return { ok: false, error: "La fecha de fin del patrón no puede ser anterior a la de inicio." };
      }

      let turnoIds: string[];
      if (input.semanas) {
        turnoIds = input.semanas.flatMap((s) => s.dias.filter((d): d is string => Boolean(d)));
      } else {
        const { data: sem } = await supabase
          .from("rrhh_patron_semanas")
          .select("dias")
          .eq("patron_id", id);
        turnoIds = (sem ?? []).flatMap((s) =>
          ((s.dias ?? []) as (string | null)[]).filter((d): d is string => Boolean(d)),
        );
      }

      const errCobertura = await validarTurnosCubrenPatron(
        supabase,
        pat.empresa_id as string,
        turnoIds,
        desde,
        hasta,
      );
      if (errCobertura) return { ok: false, error: errCobertura };

      // Patrón de un solo tipo: los turnos deben coincidir con la jornada
      // (inmutable) del patrón. Solo aplica si cambian las semanas.
      if (input.semanas) {
        const errJornada = await validarTurnosMismaJornada(
          supabase,
          pat.empresa_id as string,
          turnoIds,
          ((pat.tipo_jornada as TipoJornada | null) ?? "fijo"),
        );
        if (errJornada) return { ok: false, error: errJornada };
      }
    }

    const headerPayload: Record<string, unknown> = {};
    if (input.nombre !== undefined) headerPayload.nombre = input.nombre.trim();
    if (input.activo !== undefined) headerPayload.activo = input.activo;
    if (input.vigente_desde !== undefined) headerPayload.vigente_desde = input.vigente_desde;
    if (input.vigente_hasta !== undefined) headerPayload.vigente_hasta = input.vigente_hasta;

    if (Object.keys(headerPayload).length > 0) {
      const { error } = await supabase
        .from("rrhh_patrones")
        .update(headerPayload)
        .eq("id", id);
      if (error) throw error;
    }

    if (input.semanas) {
      // Replace all semanas: delete then insert (transactional via single round-trip ideal, pero
      // RLS + tabla pequeña permite este enfoque simple).
      const { error: errDel } = await supabase
        .from("rrhh_patron_semanas")
        .delete()
        .eq("patron_id", id);
      if (errDel) throw errDel;

      if (input.semanas.length > 0) {
        const rows = input.semanas.map((s) => ({
          patron_id: id,
          orden: s.orden,
          dias: s.dias,
        }));
        const { error: errIns } = await supabase
          .from("rrhh_patron_semanas")
          .insert(rows);
        if (errIns) throw errIns;
      }
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[patrones] updatePatron:", msg);
    return { ok: false, error: msg };
  }
}

// ─── DELETE ────────────────────────────────────────────────────────────
export async function deletePatron(id: string) {
  try {
    const { supabase } = await getAppContext();

    // Nunca se borra un patrón (ni su familia) si algún empleado lo tiene/tuvo
    // asignado: la versión debe quedar siempre almacenada como histórico.
    const { data: actual } = await supabase
      .from("rrhh_patrones")
      .select("familia_id, empresa_id")
      .eq("id", id)
      .maybeSingle();
    if (actual?.familia_id) {
      const { data: versiones } = await supabase
        .from("rrhh_patrones")
        .select("id")
        .eq("familia_id", actual.familia_id as string)
        .eq("empresa_id", actual.empresa_id as string);
      const ids = (versiones ?? []).map((v) => v.id as string);
      if (ids.length > 0) {
        const { count } = await supabase
          .from("rrhh_patron_empleados")
          .select("empleado_id", { count: "exact", head: true })
          .in("patron_id", ids);
        if ((count ?? 0) > 0) {
          return {
            ok: false,
            error: "No se puede eliminar: hay empleados con este patrón asignado. Debe conservarse como histórico.",
          };
        }
      }
    }

    const { error } = await supabase.from("rrhh_patrones").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[patrones] deletePatron:", msg);
    return { ok: false, error: msg };
  }
}

// ─── Versionado de patrones ─────────────────────────────────────────────────
// Editar un patrón NO se hace en sitio: crea una versión nueva (oficial) y la
// anterior queda como histórico no editable. Las asignaciones de empleados se
// arrastran a la versión nueva para no romper el fichaje actual. La fecha de
// creación de cada versión = created_at.

export async function crearVersionPatron(
  patronId: string,
  input: {
    nombre?: string;
    tipo_jornada?: TipoJornada;
    departamento?: string | null;
    semanas: { orden: number; dias: (string | null)[] }[];
  },
) {
  try {
    const { supabase, userId } = await getAppContext();

    const { data: actual, error: eAct } = await supabase
      .from("rrhh_patrones")
      .select("id, empresa_id, familia_id, nombre, tipo, tipo_jornada, departamento")
      .eq("id", patronId)
      .single();
    if (eAct) throw eAct;
    const empresaId = actual.empresa_id as string;
    const familiaId = actual.familia_id as string;
    const jornada = (input.tipo_jornada ?? (actual.tipo_jornada as TipoJornada) ?? "fijo") as TipoJornada;
    // El departamento se arrastra de la versión anterior salvo que se cambie.
    const departamento =
      input.departamento !== undefined
        ? input.departamento?.trim() || null
        : ((actual.departamento as string | null) ?? null);

    // Patrón de un solo tipo: turnos del patrón deben ser de su misma jornada.
    const turnoIds = input.semanas.flatMap((s) => s.dias.filter((d): d is string => Boolean(d)));
    const errJornada = await validarTurnosMismaJornada(supabase, empresaId, turnoIds, jornada);
    if (errJornada) return { ok: false, error: errJornada };

    // Versión oficial actual de la familia.
    const { data: oficial } = await supabase
      .from("rrhh_patrones")
      .select("id, version")
      .eq("familia_id", familiaId)
      .eq("empresa_id", empresaId)
      .eq("es_oficial", true)
      .maybeSingle();
    const oficialId = (oficial?.id as string) ?? patronId;

    const { data: maxRow } = await supabase
      .from("rrhh_patrones")
      .select("version")
      .eq("familia_id", familiaId)
      .eq("empresa_id", empresaId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nuevaVersion = ((maxRow?.version as number | undefined) ?? 1) + 1;

    const { data: profile } = await supabase
      .from("usuarios")
      .select("nombre, apellidos")
      .eq("user_id", userId)
      .single();
    const creadorNombre =
      [profile?.nombre, profile?.apellidos].filter(Boolean).join(" ").trim() || "Usuario";

    // 1) La versión oficial anterior deja de serlo.
    await supabase.from("rrhh_patrones").update({ es_oficial: false }).eq("id", oficialId);

    // 2) Insertar la versión nueva oficial (misma familia).
    const { data: nuevo, error: eIns } = await supabase
      .from("rrhh_patrones")
      .insert({
        empresa_id: empresaId,
        familia_id: familiaId,
        version: nuevaVersion,
        es_oficial: true,
        nombre: (input.nombre ?? (actual.nombre as string)).trim(),
        tipo: actual.tipo,
        tipo_jornada: jornada,
        departamento,
        creado_por_user_id: userId,
        creado_por_nombre: creadorNombre,
        activo: true,
      })
      .select()
      .single();
    if (eIns) {
      // Revertir el flag oficial si falla la inserción.
      await supabase.from("rrhh_patrones").update({ es_oficial: true }).eq("id", oficialId);
      throw eIns;
    }

    // 3) Semanas de la versión nueva.
    if (input.semanas.length > 0) {
      const rows = input.semanas.map((s) => ({
        patron_id: nuevo.id as string,
        orden: s.orden,
        dias: s.dias,
      }));
      const { error: eSem } = await supabase.from("rrhh_patron_semanas").insert(rows);
      if (eSem) throw eSem;
    }

    // 4) Arrastrar empleados asignados a la versión nueva (no romper fichaje).
    await supabase
      .from("rrhh_patron_empleados")
      .update({ patron_id: nuevo.id as string })
      .eq("patron_id", oficialId);

    return { ok: true, data: nuevo as PatronRow };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[patrones] crearVersionPatron:", msg);
    return { ok: false, error: msg };
  }
}

// Histórico de versiones de la familia de un patrón, de la más reciente a la
// más antigua. Incluye created_at (día en que se creó cada versión).
export async function getVersionesPatron(
  patronId: string,
): Promise<{ ok: boolean; data: PatronCompleto[]; error?: string }> {
  try {
    const { supabase } = await getAppContext();
    const { data: actual } = await supabase
      .from("rrhh_patrones")
      .select("familia_id, empresa_id")
      .eq("id", patronId)
      .maybeSingle();
    if (!actual?.familia_id) return { ok: true, data: [] };

    const { data: versiones, error } = await supabase
      .from("rrhh_patrones")
      .select("*")
      .eq("familia_id", actual.familia_id as string)
      .eq("empresa_id", actual.empresa_id as string)
      .order("version", { ascending: false });
    if (error) throw error;

    const ids = (versiones ?? []).map((p) => p.id as string);
    const { data: semanas } = ids.length
      ? await supabase
          .from("rrhh_patron_semanas")
          .select("patron_id, orden, dias")
          .in("patron_id", ids)
          .order("orden", { ascending: true })
      : { data: [] as { patron_id: string; orden: number; dias: (string | null)[] }[] };

    const semanasByPatron = new Map<string, { orden: number; dias: (string | null)[] }[]>();
    for (const s of semanas ?? []) {
      const arr = semanasByPatron.get(s.patron_id as string) ?? [];
      arr.push({ orden: s.orden as number, dias: s.dias as (string | null)[] });
      semanasByPatron.set(s.patron_id as string, arr);
    }

    const data: PatronCompleto[] = (versiones ?? []).map((p) => ({
      ...(p as PatronRow),
      semanas: semanasByPatron.get(p.id as string) ?? [],
      empleadosAsignados: 0,
    }));
    return { ok: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[patrones] getVersionesPatron:", msg);
    return { ok: false, data: [], error: msg };
  }
}

// ─── Asignación de empleados a un patrón ────────────────────────────────────
// Lo que hace que un patrón "funcione": vincular empleados. A partir de aquí su
// horario (turnos por día de semana) rige sus fichajes durante la vigencia del
// patrón. La fecha de la asignación = inicio del patrón, para que el empleado lo
// siga en todo su rango (el motor de fichaje ya recorta por las fechas).

export async function getEmpleadosDePatron(
  patronId: string,
): Promise<{ ok: boolean; data: string[]; error?: string }> {
  try {
    const { supabase } = await getAppContext();
    const { data, error } = await supabase
      .from("rrhh_patron_empleados")
      .select("empleado_id")
      .eq("patron_id", patronId);
    if (error) throw error;
    return { ok: true, data: (data ?? []).map((r) => r.empleado_id as string) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[patrones] getEmpleadosDePatron:", msg);
    return { ok: false, data: [], error: msg };
  }
}

// Reemplaza el conjunto completo de empleados asignados a un patrón.
export async function asignarEmpleadosPatron(
  patronId: string,
  empleadoIds: string[],
) {
  try {
    const { supabase, userId } = await getAppContext();

    // Fecha de inicio del patrón → fecha de la asignación.
    const { data: patron, error: ePat } = await supabase
      .from("rrhh_patrones")
      .select("vigente_desde")
      .eq("id", patronId)
      .single();
    if (ePat) throw ePat;
    const vigenteDesde = (patron?.vigente_desde as string) || hoyISODate();

    const idsUnicos = Array.from(new Set(empleadoIds.filter(Boolean)));

    // Borra los que ya no estén seleccionados.
    const delQuery = supabase
      .from("rrhh_patron_empleados")
      .delete()
      .eq("patron_id", patronId);
    const { error: errDel } = idsUnicos.length
      ? await delQuery.not("empleado_id", "in", `(${idsUnicos.join(",")})`)
      : await delQuery;
    if (errDel) throw errDel;

    // Inserta los nuevos (idempotente vía UNIQUE(patron_id, empleado_id)).
    if (idsUnicos.length) {
      const rows = idsUnicos.map((empleadoId) => ({
        patron_id: patronId,
        empleado_id: empleadoId,
        vigente_desde: vigenteDesde,
        asignado_por_user_id: userId,
      }));
      const { error: errIns } = await supabase
        .from("rrhh_patron_empleados")
        .upsert(rows, { onConflict: "patron_id,empleado_id", ignoreDuplicates: true });
      if (errIns) throw errIns;
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[patrones] asignarEmpleadosPatron:", msg);
    return { ok: false, error: msg };
  }
}
