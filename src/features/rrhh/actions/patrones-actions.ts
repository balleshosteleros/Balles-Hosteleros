"use server";

import { getAppContext } from "@/lib/supabase/get-context";

export type PatronTipo = "semanal" | "libre";

export type PatronRow = {
  id: string;
  empresa_id: string;
  nombre: string;
  tipo: PatronTipo;
  creado_por_user_id: string | null;
  creado_por_nombre: string;
  activo: boolean;
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
  semanas: { orden: number; dias: (string | null)[] }[];
  activo?: boolean;
};

export type EmpleadoBasico = {
  id: string;
  nombre: string;
  apellidos: string | null;
};

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

    // Snapshot del nombre del usuario en este momento (no cambia si se da de baja).
    const { data: profile } = await supabase
      .from("profiles")
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
        creado_por_user_id: userId,
        creado_por_nombre: creadorNombre,
        activo: input.activo ?? true,
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
  input: Partial<Pick<PatronInput, "nombre" | "activo">> & {
    semanas?: { orden: number; dias: (string | null)[] }[];
  }
) {
  try {
    const { supabase } = await getAppContext();

    const headerPayload: Record<string, unknown> = {};
    if (input.nombre !== undefined) headerPayload.nombre = input.nombre.trim();
    if (input.activo !== undefined) headerPayload.activo = input.activo;

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
    const { error } = await supabase.from("rrhh_patrones").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[patrones] deletePatron:", msg);
    return { ok: false, error: msg };
  }
}
