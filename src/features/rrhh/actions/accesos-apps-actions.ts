"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import {
  type AccesoApp,
  type AccesoCredencial,
  MAX_ACCESOS_POR_APP,
} from "@/features/rrhh/data/accesos-apps";

type Row = {
  id: string;
  empresa_slug: string;
  empresa_id: string | null;
  nombre: string;
  descripcion: string;
  url: string;
  icono: string;
  logo_url: string | null;
  categoria: string;
  departamentos: string[];
  roles_autorizados: string[];
  accesos: AccesoCredencial[] | null;
  usuario: string;
  contrasena: string;
  estado: AccesoApp["estado"];
  responsable: string;
  notas: string;
  tipo_integracion: AccesoApp["tipoIntegracion"];
  updated_at: string;
};

/** Normaliza la lista de accesos: filtra vacíos y aplica el tope de 10. */
function normalizarAccesos(accesos?: AccesoCredencial[] | null): AccesoCredencial[] {
  const list = (accesos ?? [])
    .map((a) => ({
      etiqueta: (a.etiqueta ?? "").trim(),
      usuario: (a.usuario ?? "").trim(),
      contrasena: a.contrasena ?? "",
      roles: Array.isArray(a.roles)
        ? a.roles.map((r) => (r ?? "").trim()).filter(Boolean)
        : [],
    }))
    .filter((a) => a.etiqueta || a.usuario || a.contrasena);
  return list.slice(0, MAX_ACCESOS_POR_APP);
}

function rowToApp(r: Row): AccesoApp {
  const accesos = normalizarAccesos(r.accesos);
  // Compat: si no hay array pero sí columnas legacy, materializa un acceso.
  if (accesos.length === 0 && (r.usuario || r.contrasena)) {
    accesos.push({ etiqueta: "", usuario: r.usuario, contrasena: r.contrasena });
  }
  return {
    id: r.id,
    empresaId: r.empresa_slug,
    nombre: r.nombre,
    descripcion: r.descripcion,
    url: r.url,
    icono: r.icono,
    logoUrl: r.logo_url ?? undefined,
    categoria: r.categoria,
    departamentos: r.departamentos ?? [],
    rolesAutorizados: r.roles_autorizados ?? [],
    accesos,
    usuario: accesos[0]?.usuario ?? r.usuario ?? "",
    contrasena: accesos[0]?.contrasena ?? r.contrasena ?? "",
    estado: r.estado,
    responsable: r.responsable,
    notas: r.notas,
    tipoIntegracion: r.tipo_integracion,
    ultimaActualizacion: (r.updated_at ?? "").slice(0, 10),
  };
}

function appToRow(a: Partial<AccesoApp> & { id: string; empresaId: string }) {
  const accesos = normalizarAccesos(a.accesos);
  return {
    id: a.id,
    empresa_slug: a.empresaId,
    nombre: a.nombre ?? "",
    descripcion: a.descripcion ?? "",
    url: a.url ?? "",
    icono: a.icono ?? "🔗",
    logo_url: a.logoUrl ?? null,
    categoria: a.categoria ?? "Otros",
    departamentos: a.departamentos ?? [],
    roles_autorizados: a.rolesAutorizados ?? [],
    accesos,
    // Legacy sincronizado con el primer acceso (compatibilidad).
    usuario: accesos[0]?.usuario ?? a.usuario ?? "",
    contrasena: accesos[0]?.contrasena ?? a.contrasena ?? "",
    estado: a.estado ?? "Activo",
    responsable: a.responsable ?? "",
    notas: a.notas ?? "",
    tipo_integracion: a.tipoIntegracion ?? "enlace",
  };
}

/**
 * Resuelve empresa_id (uuid) a partir del slug usando la sesión del usuario,
 * de forma que RLS (`empresas_read`) garantice que el usuario tiene acceso.
 * Devuelve null si el slug no existe o el usuario no pertenece a esa empresa.
 */
async function resolverEmpresaIdDesdeSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slug: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("empresas")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return data.id as string;
}

async function getUserOrNull(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function userTieneRolAdminODirector(userId: string): Promise<boolean> {
  const { esDirector } = await getRolContext(userId);
  return esDirector;
}

/** Lista accesos de UNA empresa. RLS enforça que el usuario pertenezca a ella. */
export async function listAccesosApps(empresaSlug: string): Promise<AccesoApp[]> {
  const supabase = await createClient();
  const user = await getUserOrNull(supabase);
  if (!user) return [];

  const { data, error } = await supabase
    .from("accesos_apps")
    .select("*")
    .eq("empresa_slug", empresaSlug)
    .order("categoria", { ascending: true })
    .order("nombre", { ascending: true });
  if (error) {
    console.error("[accesos-apps] listAccesosApps:", error);
    return [];
  }
  return (data ?? []).map((r) => rowToApp(r as Row));
}

/**
 * Lista TODOS los accesos (todas las empresas). Solo admin/director.
 * Otros usuarios reciben array vacío (no se filtra: se rechaza).
 */
export async function listAllAccesosApps(): Promise<AccesoApp[]> {
  const supabase = await createClient();
  const user = await getUserOrNull(supabase);
  if (!user) return [];
  if (!(await userTieneRolAdminODirector(user.id))) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("accesos_apps")
    .select("*")
    .order("empresa_slug", { ascending: true })
    .order("categoria", { ascending: true })
    .order("nombre", { ascending: true });
  if (error) {
    console.error("[accesos-apps] listAllAccesosApps:", error);
    return [];
  }
  return (data ?? []).map((r) => rowToApp(r as Row));
}

/** Crea un acceso. RLS rechaza si el usuario no pertenece a la empresa indicada. */
export async function createAccesoApp(
  app: Omit<AccesoApp, "id" | "ultimaActualizacion"> & { id?: string },
): Promise<AccesoApp> {
  const supabase = await createClient();
  const user = await getUserOrNull(supabase);
  if (!user) throw new Error("No autorizado");

  const empresaId = await resolverEmpresaIdDesdeSlug(supabase, app.empresaId);
  if (!empresaId) throw new Error("Empresa no encontrada o sin acceso");

  const id = app.id?.trim() || `app-${Date.now()}`;
  const row = { ...appToRow({ ...app, id }), empresa_id: empresaId };
  const { data, error } = await supabase
    .from("accesos_apps")
    .insert(row)
    .select("*")
    .single();
  if (error) {
    console.error("[accesos-apps] createAccesoApp:", error);
    throw new Error(`Error al crear acceso: ${error.message}`);
  }
  return rowToApp(data as Row);
}

/** Actualiza un acceso por id. RLS rechaza cross-tenant. */
export async function updateAccesoApp(
  id: string,
  patch: Partial<AccesoApp>,
): Promise<AccesoApp> {
  const supabase = await createClient();
  const user = await getUserOrNull(supabase);
  if (!user) throw new Error("No autorizado");

  const row = appToRow({ ...patch, id, empresaId: patch.empresaId ?? "" });
  // Si el patch no trae empresaId, no sobreescribir empresa_slug (ni empresa_id)
  if (!patch.empresaId) {
    delete (row as Partial<typeof row>).empresa_slug;
  } else {
    const empresaId = await resolverEmpresaIdDesdeSlug(supabase, patch.empresaId);
    if (!empresaId) throw new Error("Empresa no encontrada o sin acceso");
    (row as Record<string, unknown>).empresa_id = empresaId;
  }

  const { data, error } = await supabase
    .from("accesos_apps")
    .update(row)
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    console.error("[accesos-apps] updateAccesoApp:", error);
    throw new Error(`Error al actualizar acceso: ${error.message}`);
  }
  return rowToApp(data as Row);
}

/** Elimina un acceso por id. RLS rechaza cross-tenant. */
export async function deleteAccesoApp(id: string): Promise<void> {
  const supabase = await createClient();
  const user = await getUserOrNull(supabase);
  if (!user) throw new Error("No autorizado");

  const { error } = await supabase.from("accesos_apps").delete().eq("id", id);
  if (error) {
    console.error("[accesos-apps] deleteAccesoApp:", error);
    throw new Error(`Error al eliminar acceso: ${error.message}`);
  }
}
