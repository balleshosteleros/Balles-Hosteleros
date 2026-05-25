"use server";

/**
 * Sincronizador de seeds canónicos → BD.
 *
 * Estrategia: ADITIVA — solo inserta lo que falta. NUNCA borra, renombra ni
 * sobreescribe registros existentes en las empresas. Si un cliente personalizó
 * un departamento o rol, su personalización se respeta.
 *
 * - `seedEmpresaDefaults(empresaId, empresaSlug)`: siembra una empresa nueva.
 * - `syncSeedsToAllEmpresas()`: propaga los seeds a TODAS las empresas existentes.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { DEPARTAMENTOS_SEED, normalizeDeptoNombre } from "./departamentos";
import { ROLES_SEED, normalizeRolNombre } from "./roles";
import { ORGANIGRAMA_SEED } from "./organigrama";

type Admin = ReturnType<typeof createAdminClient>;

/** Devuelve el id del departamento de una empresa por nombre, o null si no existe. */
async function getDeptoIdByNombre(
  admin: Admin,
  empresaId: string,
  nombre: string,
): Promise<string | null> {
  const { data } = await admin
    .from("departamentos")
    .select("id, nombre")
    .eq("empresa_id", empresaId);
  const target = normalizeDeptoNombre(nombre);
  const match = (data ?? []).find(
    (d) => normalizeDeptoNombre(d.nombre as string) === target,
  );
  return (match?.id as string) ?? null;
}

/**
 * Sincroniza departamentos canónicos a una empresa concreta (aditivo).
 * Inserta los departamentos del seed que aún no existen en la empresa.
 * Si ya existen (por nombre, case-insensitive), respeta lo que hay.
 */
export async function syncDepartamentosAEmpresa(
  admin: Admin,
  empresaId: string,
): Promise<{ creados: number }> {
  const { data: existentes } = await admin
    .from("departamentos")
    .select("nombre")
    .eq("empresa_id", empresaId);
  const setExistentes = new Set(
    (existentes ?? []).map((d) => normalizeDeptoNombre(d.nombre as string)),
  );

  const aCrear = DEPARTAMENTOS_SEED
    .filter((d) => !setExistentes.has(normalizeDeptoNombre(d.nombre)))
    .map((d) => ({
      empresa_id: empresaId,
      nombre: d.nombre,
      descripcion: d.descripcion,
      area: d.area,
      estado: d.estado,
    }));

  if (aCrear.length === 0) return { creados: 0 };
  const { error } = await admin.from("departamentos").insert(aCrear);
  if (error) throw error;
  return { creados: aCrear.length };
}

/**
 * Sincroniza roles canónicos a una empresa concreta (aditivo).
 * Resuelve `departamento_id` por nombre dentro de la empresa.
 */
export async function syncRolesAEmpresa(
  admin: Admin,
  empresaId: string,
): Promise<{ creados: number }> {
  const { data: deptos } = await admin
    .from("departamentos")
    .select("id, nombre")
    .eq("empresa_id", empresaId);
  const deptoIdPorNombre = new Map(
    ((deptos ?? []) as Array<{ id: string; nombre: string }>).map((d) => [
      normalizeDeptoNombre(d.nombre),
      d.id,
    ]),
  );

  const { data: existentes } = await admin
    .from("empresa_roles")
    .select("nombre")
    .eq("empresa_id", empresaId);
  const setExistentes = new Set(
    (existentes ?? []).map((r) => normalizeRolNombre(r.nombre as string)),
  );

  const aCrear = ROLES_SEED
    .filter((r) => !setExistentes.has(normalizeRolNombre(r.nombre)))
    .map((r) => ({
      empresa_id: empresaId,
      nombre: r.nombre,
      descripcion: r.descripcion,
      permisos: r.permisos,
      protected: r.protected,
      departamento_id: r.departamento
        ? deptoIdPorNombre.get(normalizeDeptoNombre(r.departamento)) ?? null
        : null,
    }));

  if (aCrear.length === 0) return { creados: 0 };
  const { error } = await admin.from("empresa_roles").insert(aCrear);
  if (error) throw error;
  return { creados: aCrear.length };
}

/**
 * Siembra el organigrama base SOLO si la empresa no tiene uno aún.
 * Si ya existe (incluso personalizado), no se toca.
 */
export async function syncOrganigramaAEmpresa(
  admin: Admin,
  empresaSlug: string,
): Promise<{ creado: boolean }> {
  const { data: existente } = await admin
    .from("organigramas")
    .select("empresa_slug")
    .eq("empresa_slug", empresaSlug)
    .maybeSingle();
  if (existente) return { creado: false };

  const { error } = await admin.from("organigramas").insert({
    empresa_slug: empresaSlug,
    nodes: ORGANIGRAMA_SEED.nodes,
    edges: ORGANIGRAMA_SEED.edges,
    zones: ORGANIGRAMA_SEED.zones,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return { creado: true };
}

/**
 * Siembra vacantes en borrador a partir de los nodos del organigrama de la
 * empresa (aditivo: solo crea vacantes cuyo título no exista ya).
 */
export async function syncVacantesAEmpresa(
  admin: Admin,
  empresaId: string,
  empresaSlug: string,
): Promise<{ creadas: number }> {
  const { data: org } = await admin
    .from("organigramas")
    .select("nodes")
    .eq("empresa_slug", empresaSlug)
    .maybeSingle();
  const nodos = ((org?.nodes ?? []) as Array<{ label: string }>) ?? [];
  if (nodos.length === 0) return { creadas: 0 };

  const { data: vacExistentes } = await admin
    .from("vacantes")
    .select("titulo")
    .eq("empresa_id", empresaId);
  const setExistentes = new Set(
    (vacExistentes ?? []).map((v) => (v.titulo as string).trim().toLowerCase()),
  );

  const vistos = new Set<string>();
  const aCrear = nodos
    .filter((n) => {
      const key = (n.label ?? "").trim().toLowerCase();
      if (!key || vistos.has(key) || setExistentes.has(key)) return false;
      vistos.add(key);
      return true;
    })
    .map((n) => ({
      empresa_id: empresaId,
      titulo: n.label,
      tipo_jornada: "completa",
      estado_publicacion: "borrador",
      visible_publicamente: false,
      cuestionario: false,
      favorita: false,
    }));

  if (aCrear.length === 0) return { creadas: 0 };
  const { error } = await admin.from("vacantes").insert(aCrear);
  if (error) throw error;
  return { creadas: aCrear.length };
}

/**
 * Siembra una empresa nueva con todos los pilares canónicos.
 * Llamar desde `createEmpresa()` justo después del INSERT en `empresas`.
 */
export async function seedEmpresaDefaults(
  empresaId: string,
  empresaSlug: string,
): Promise<void> {
  const admin = createAdminClient();
  await syncDepartamentosAEmpresa(admin, empresaId);
  await syncRolesAEmpresa(admin, empresaId);
  await syncOrganigramaAEmpresa(admin, empresaSlug);
  await syncVacantesAEmpresa(admin, empresaId, empresaSlug);
}

/**
 * Propaga los seeds canónicos a TODAS las empresas existentes (aditivo).
 * Llamar cuando se edita un seed para alinear el universo.
 * Devuelve un resumen por empresa.
 */
export async function syncSeedsToAllEmpresas(): Promise<{
  ok: boolean;
  resumen: Array<{
    empresa: string;
    deptosCreados: number;
    rolesCreados: number;
    organigramaCreado: boolean;
    vacantesCreadas: number;
  }>;
  error?: string;
}> {
  try {
    const admin = createAdminClient();
    const { data: empresas, error } = await admin
      .from("empresas")
      .select("id, slug, nombre")
      .eq("is_demo", false);
    if (error) throw error;

    const resumen: Array<{
      empresa: string;
      deptosCreados: number;
      rolesCreados: number;
      organigramaCreado: boolean;
      vacantesCreadas: number;
    }> = [];

    for (const e of empresas ?? []) {
      const empresaId = e.id as string;
      const empresaSlug = e.slug as string;
      const empresaNombre = (e.nombre as string) ?? empresaSlug;
      const d = await syncDepartamentosAEmpresa(admin, empresaId);
      const r = await syncRolesAEmpresa(admin, empresaId);
      const o = await syncOrganigramaAEmpresa(admin, empresaSlug);
      const v = await syncVacantesAEmpresa(admin, empresaId, empresaSlug);
      resumen.push({
        empresa: empresaNombre,
        deptosCreados: d.creados,
        rolesCreados: r.creados,
        organigramaCreado: o.creado,
        vacantesCreadas: v.creadas,
      });
    }

    return { ok: true, resumen };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[seeds] syncSeedsToAllEmpresas:", msg);
    return { ok: false, resumen: [], error: msg };
  }
}

// Re-export del helper (lo necesita pagos-actions u otros lugares).
export { getDeptoIdByNombre };
