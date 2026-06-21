"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import type { SupabaseClient } from "@supabase/supabase-js";
async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null, esDirector: false };
  const [empresaId, { esDirector }] = await Promise.all([
    getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id),
    getRolContext(),
  ]);
  return {
    supabase,
    user,
    empresaId,
    esDirector,
  };
}

/**
 * Devuelve la empresa con la que operar. Si se pasa `empresaIdOverride`,
 * admin y director pueden usarlo; el resto se queda con la suya.
 */
function resolverEmpresa(
  empresaId: string | null,
  esDirector: boolean,
  empresaIdOverride?: string | null
): string | null {
  if (empresaIdOverride && esDirector) return empresaIdOverride;
  return empresaId;
}

async function resolveEmpresaAutorizada(
  userId: string,
  empresaId: string | null,
  esDirector: boolean,
  empresaIdOverride?: string | null
): Promise<string | null> {
  const target = resolverEmpresa(empresaId, esDirector, empresaIdOverride);
  if (!target) return null;
  if (!empresaIdOverride || target === empresaId) return target;

  const supabase = await createClient();
  const { data: acceso } = await supabase
    .from("usuario_empresas")
    .select("empresa_id")
    .eq("user_id", userId)
    .eq("empresa_id", target)
    .maybeSingle();

  if (acceso) return target;
  return null;
}

const localSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(120),
  direccion: z.string().max(300).optional().nullable(),
  ciudad: z.string().max(120).optional().nullable(),
  codigo_postal: z.string().max(12).optional().nullable(),
  pais: z.string().max(80).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  radio_metros: z.number().int().min(20).max(5000).default(100),
  color: z.string().max(40).optional().nullable(),
  notas: z.string().max(500).optional().nullable(),
  activo: z.boolean().optional(),
});

export type LocalInput = z.infer<typeof localSchema>;

export async function listLocales(empresaIdOverride?: string | null) {
  try {
    const { user, empresaId, esDirector } = await getContext();
    if (!user) return { ok: false, data: [], error: "No autenticado" };
    const target = await resolveEmpresaAutorizada(
      user.id,
      empresaId,
      esDirector,
      empresaIdOverride
    );
    if (!target) return { ok: false, data: [], error: "Sin empresa activa" };
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("locales")
      .select(
        "id, empresa_id, nombre, direccion, ciudad, codigo_postal, pais, lat, lng, radio_metros, color, notas, activo, created_at, updated_at"
      )
      .eq("empresa_id", target)
      .order("nombre", { ascending: true });
    if (error) throw error;

    const ids = (data ?? []).map((c) => c.id);
    let counts: Record<string, number> = {};
    if (ids.length > 0) {
      // Conteo de empleados por local desde la tabla puente (multi-local).
      const { data: asignaciones } = await admin
        .from("empleado_locales")
        .select("local_id")
        .in("local_id", ids);
      counts = (asignaciones ?? []).reduce<Record<string, number>>((acc, a) => {
        if (a.local_id) acc[a.local_id] = (acc[a.local_id] ?? 0) + 1;
        return acc;
      }, {});
    }
    return {
      ok: true,
      data: (data ?? []).map((c) => ({ ...c, empleados_count: counts[c.id] ?? 0 })),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[locales] list:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export async function createLocal(
  input: LocalInput,
  empresaIdOverride?: string | null
) {
  try {
    const parsed = localSchema.parse(input);
    const { user, empresaId, esDirector } = await getContext();
    const target = user
      ? await resolveEmpresaAutorizada(user.id, empresaId, esDirector, empresaIdOverride)
      : null;
    if (!user || !target) return { ok: false, error: "No autenticado" };
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("locales")
      .insert({
        empresa_id: target,
        nombre: parsed.nombre,
        direccion: parsed.direccion ?? null,
        ciudad: parsed.ciudad ?? null,
        codigo_postal: parsed.codigo_postal ?? null,
        pais: parsed.pais ?? "España",
        lat: parsed.lat ?? null,
        lng: parsed.lng ?? null,
        radio_metros: parsed.radio_metros,
        color: parsed.color ?? "bg-violet-500",
        notas: parsed.notas ?? null,
        activo: parsed.activo ?? true,
        created_by: user.id,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[locales] create:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateLocal(id: string, input: Partial<LocalInput>) {
  try {
    const parsed = localSchema.partial().parse(input);
    const { supabase } = await getContext();
    const { error } = await supabase.from("locales").update(parsed).eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[locales] update:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteLocal(id: string) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // Regla de negocio: la empresa debe conservar al menos 1 local en todo
    // momento (los planos, mesas, empleados y fichajes apuntan a un local).
    const { count } = await supabase
      .from("locales")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId);
    if ((count ?? 0) <= 1) {
      return { ok: false, error: "Cada empresa debe tener al menos un local. Crea otro antes de borrar este." };
    }

    const { error } = await supabase.from("locales").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[locales] delete:", msg);
    return { ok: false, error: msg };
  }
}

export async function listEmpleadosLocal(localId: string) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [] };
    // Empleados asignados a este local vía la tabla puente (multi-local).
    const { data, error } = await supabase
      .from("empleado_locales")
      .select("empleados!inner(id, nombre, apellidos, estado, permite_teletrabajo)")
      .eq("local_id", localId);
    if (error) throw error;
    const empleados = (data ?? [])
      .map((row) => (row as { empleados: unknown }).empleados)
      .filter(Boolean) as Array<Record<string, unknown>>;
    empleados.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
    return { ok: true, data: empleados };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, data: [], error: msg };
  }
}

export async function listEmpleadosEmpresaParaLocales(
  empresaIdOverride?: string | null
) {
  try {
    const { user, empresaId, esDirector } = await getContext();
    if (!user) return { ok: false, data: [] };
    const target = await resolveEmpresaAutorizada(
      user.id,
      empresaId,
      esDirector,
      empresaIdOverride
    );
    if (!target) return { ok: false, data: [] };
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("empleados")
      .select("id, nombre, apellidos, estado, local_id, permite_teletrabajo")
      .eq("empresa_id", target)
      .order("nombre");
    if (error) throw error;
    const empleados = data ?? [];

    // Locales asignados (de ESTA empresa) por empleado, vía la tabla puente.
    const empleadoIds = empleados.map((e) => e.id);
    const porEmpleado: Record<string, string[]> = {};
    if (empleadoIds.length > 0) {
      const { data: asignaciones } = await admin
        .from("empleado_locales")
        .select("empleado_id, locales!inner(id, empresa_id)")
        .in("empleado_id", empleadoIds)
        .eq("locales.empresa_id", target);
      for (const row of asignaciones ?? []) {
        const r = row as unknown as { empleado_id: string; locales: { id: string } | null };
        if (!r.locales?.id) continue;
        (porEmpleado[r.empleado_id] ??= []).push(r.locales.id);
      }
    }

    return {
      ok: true,
      data: empleados.map((e) => ({ ...e, local_ids: porEmpleado[e.id] ?? [] })),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, data: [], error: msg };
  }
}

/** Locales (ids) donde el empleado puede fichar, de todas sus empresas. */
/**
 * Locales de fichaje de la PERSONA (no de una sola ficha): un empleado
 * multi-empresa tiene una fila de `empleados` por empresa, y cada local vive en
 * el puente de la ficha de SU empresa. La tarjeta de gestión muestra los locales
 * de todas sus empresas, así que aquí devolvemos la UNIÓN de los puentes de
 * todas sus fichas (por `user_id`). Si no, el local de la otra empresa saldría
 * desmarcado aunque sí esté asignado.
 */
export async function getLocalesEmpleado(empleadoId: string) {
  try {
    const { supabase } = await getContext();
    const { data: emp } = await supabase
      .from("empleados")
      .select("user_id")
      .eq("id", empleadoId)
      .maybeSingle();
    const empleadoIds = await idsFichasDelEmpleado(supabase, empleadoId, emp?.user_id ?? null);
    const { data, error } = await supabase
      .from("empleado_locales")
      .select("local_id")
      .in("empleado_id", empleadoIds);
    if (error) throw error;
    const ids = Array.from(new Set((data ?? []).map((r) => r.local_id as string)));
    return { ok: true, data: ids };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[locales] getLocalesEmpleado:", msg);
    return { ok: false, data: [], error: msg };
  }
}

/** Todas las fichas (`empleados.id`) de la misma persona; al menos la propia. */
async function idsFichasDelEmpleado(
  supabase: Awaited<ReturnType<typeof getContext>>["supabase"],
  empleadoId: string,
  userId: string | null,
): Promise<string[]> {
  if (!userId) return [empleadoId];
  const { data } = await supabase
    .from("empleados")
    .select("id")
    .eq("user_id", userId);
  const ids = (data ?? []).map((r) => r.id as string);
  return ids.length > 0 ? ids : [empleadoId];
}

/**
 * Recalcula empleados.local_id (local "por defecto", compat con lecturas
 * existentes) tras cambiar el conjunto: prioriza un local de la empresa
 * principal del empleado; si no hay, el primero del conjunto; si está vacío, null.
 */
async function recomputarLocalPorDefecto(
  supabase: Awaited<ReturnType<typeof getContext>>["supabase"],
  empleadoId: string,
) {
  const { data: emp } = await supabase
    .from("empleados")
    .select("empresa_id")
    .eq("id", empleadoId)
    .maybeSingle();
  const { data: asignados } = await supabase
    .from("empleado_locales")
    .select("local_id, locales!inner(id, empresa_id)")
    .eq("empleado_id", empleadoId);
  const filas = (asignados ?? []).map(
    (r) => (r as unknown as { locales: { id: string; empresa_id: string } }).locales,
  );
  const principal = emp?.empresa_id
    ? filas.find((l) => l.empresa_id === emp.empresa_id)
    : undefined;
  const defecto = principal?.id ?? filas[0]?.id ?? null;
  await supabase.from("empleados").update({ local_id: defecto }).eq("id", empleadoId);
}

/**
 * Reemplaza el conjunto de locales donde la PERSONA puede fichar, REPARTIENDO
 * cada local a la ficha (`empleados.id`) de SU empresa. Un empleado multi-empresa
 * tiene una fila por empresa; el local debe vivir en el puente de la fila de su
 * empresa para que el fichaje (agnóstico de empresa, geo→local→empresa) resuelva
 * el `empleado.id` correcto y no aparezca un local duplicado. La tarjeta envía la
 * unión marcada en todas las empresas; aquí la desglosamos por empresa.
 */
export async function setLocalesEmpleado(empleadoId: string, localIds: string[]) {
  try {
    const { supabase } = await getContext();
    const ids = Array.from(new Set((localIds ?? []).filter(Boolean)));

    const { data: emp } = await supabase
      .from("empleados")
      .select("user_id")
      .eq("id", empleadoId)
      .maybeSingle();
    const userId = emp?.user_id ?? null;

    // Todas las fichas de la persona: empresa → empleado.id que la posee.
    const { data: fichas } = userId
      ? await supabase.from("empleados").select("id, empresa_id").eq("user_id", userId)
      : { data: null as { id: string; empresa_id: string }[] | null };
    const fichaPorEmpresa = new Map<string, string>();
    for (const f of fichas ?? []) fichaPorEmpresa.set(f.empresa_id as string, f.id as string);
    if (fichaPorEmpresa.size === 0) fichaPorEmpresa.set("__self__", empleadoId);

    // Validación: cada local debe ser de una empresa a la que la persona accede.
    const empresaPorLocal = new Map<string, string>();
    if (ids.length > 0) {
      const { data: accesos } = await supabase
        .from("usuario_empresas")
        .select("empresa_id")
        .eq("user_id", userId ?? "");
      const empresasEmpleado = new Set((accesos ?? []).map((a) => a.empresa_id as string));
      const { data: locs } = await supabase
        .from("locales")
        .select("id, empresa_id")
        .in("id", ids);
      if ((locs?.length ?? 0) !== ids.length ||
          (locs ?? []).some((l) => !empresasEmpleado.has(l.empresa_id as string))) {
        return { ok: false, error: "Algún local no pertenece a una empresa del empleado." };
      }
      for (const l of locs ?? []) empresaPorLocal.set(l.id as string, l.empresa_id as string);
    }

    // Reparte: cada local → ficha de su empresa (si la persona no tiene ficha en
    // esa empresa todavía, recae en la ficha que se está editando, como fallback).
    const localesPorFicha = new Map<string, string[]>();
    for (const fichaId of fichaPorEmpresa.values()) localesPorFicha.set(fichaId, []);
    localesPorFicha.set(empleadoId, localesPorFicha.get(empleadoId) ?? []);
    for (const localId of ids) {
      const empresa = empresaPorLocal.get(localId);
      const fichaId = (empresa && fichaPorEmpresa.get(empresa)) || empleadoId;
      localesPorFicha.get(fichaId)!.push(localId);
    }

    // Persiste cada ficha por separado y recalcula su local por defecto.
    for (const [fichaId, locales] of localesPorFicha) {
      const { error: delErr } = await supabase
        .from("empleado_locales")
        .delete()
        .eq("empleado_id", fichaId);
      if (delErr) throw delErr;
      if (locales.length > 0) {
        const rows = locales.map((local_id) => ({ empleado_id: fichaId, local_id }));
        const { error: insErr } = await supabase.from("empleado_locales").insert(rows);
        if (insErr) throw insErr;
      }
      await recomputarLocalPorDefecto(supabase, fichaId);
    }

    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[locales] setLocalesEmpleado:", msg);
    return { ok: false, error: msg };
  }
}

/** Añade un local al conjunto del empleado (idempotente). */
export async function addLocalEmpleado(empleadoId: string, localId: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("empleado_locales")
      .upsert({ empleado_id: empleadoId, local_id: localId }, { onConflict: "empleado_id,local_id" });
    if (error) throw error;
    await recomputarLocalPorDefecto(supabase, empleadoId);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[locales] addLocalEmpleado:", msg);
    return { ok: false, error: msg };
  }
}

/** Quita un local del conjunto del empleado. */
export async function removeLocalEmpleado(empleadoId: string, localId: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("empleado_locales")
      .delete()
      .eq("empleado_id", empleadoId)
      .eq("local_id", localId);
    if (error) throw error;
    await recomputarLocalPorDefecto(supabase, empleadoId);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[locales] removeLocalEmpleado:", msg);
    return { ok: false, error: msg };
  }
}

export async function setEmpleadoTeletrabajo(
  empleadoId: string,
  permite: boolean
) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("empleados")
      .update({ permite_teletrabajo: permite })
      .eq("id", empleadoId);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}
