"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { AccesoApp } from "@/features/rrhh/data/accesos-apps";

type Row = {
  id: string;
  empresa_slug: string;
  nombre: string;
  descripcion: string;
  url: string;
  icono: string;
  logo_url: string | null;
  categoria: string;
  departamentos: string[];
  roles_autorizados: string[];
  usuario: string;
  contrasena: string;
  estado: AccesoApp["estado"];
  responsable: string;
  notas: string;
  tipo_integracion: AccesoApp["tipoIntegracion"];
  updated_at: string;
};

function rowToApp(r: Row): AccesoApp {
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
    usuario: r.usuario,
    contrasena: r.contrasena,
    estado: r.estado,
    responsable: r.responsable,
    notas: r.notas,
    tipoIntegracion: r.tipo_integracion,
    ultimaActualizacion: (r.updated_at ?? "").slice(0, 10),
  };
}

function appToRow(a: Partial<AccesoApp> & { id: string; empresaId: string }) {
  return {
    id: a.id,
    empresa_slug: a.empresaId,
    nombre: a.nombre ?? "",
    descripcion: a.descripcion ?? "",
    url: a.url ?? "",
    icono: a.icono ?? "🔗",
    logo_url: a.logoUrl ?? null,
    categoria: a.categoria ?? "Sistemas de gestión",
    departamentos: a.departamentos ?? [],
    roles_autorizados: a.rolesAutorizados ?? [],
    usuario: a.usuario ?? "",
    contrasena: a.contrasena ?? "",
    estado: a.estado ?? "Activo",
    responsable: a.responsable ?? "",
    notas: a.notas ?? "",
    tipo_integracion: a.tipoIntegracion ?? "enlace",
  };
}

/** Devuelve todos los accesos de una empresa. */
export async function listAccesosApps(empresaSlug: string): Promise<AccesoApp[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("accesos_apps")
    .select("*")
    .eq("empresa_slug", empresaSlug)
    .order("categoria", { ascending: true })
    .order("nombre", { ascending: true });
  if (error) {
    console.error("[accesos-apps] listAccesosApps:", error);
    // En local/offline, devolvemos un array vacío en vez de romper la app
    return [];
  }
  return (data ?? []).map((r) => rowToApp(r as Row));
}

/** Devuelve TODOS los accesos (todas las empresas) para el panel admin. */
export async function listAllAccesosApps(): Promise<AccesoApp[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
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

/** Crea un acceso. Genera id si no se proporciona. */
export async function createAccesoApp(
  app: Omit<AccesoApp, "id" | "ultimaActualizacion"> & { id?: string },
): Promise<AccesoApp> {
  const supabase = createAdminClient();
  const id = app.id?.trim() || `app-${Date.now()}`;
  const row = appToRow({ ...app, id });
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

/** Actualiza un acceso por id. */
export async function updateAccesoApp(
  id: string,
  patch: Partial<AccesoApp>,
): Promise<AccesoApp> {
  const supabase = createAdminClient();
  const row = appToRow({ ...patch, id, empresaId: patch.empresaId ?? "" });
  // Si patch no trae empresaId, no lo sobrescribas
  if (!patch.empresaId) delete (row as Partial<typeof row>).empresa_slug;
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

/** Elimina un acceso por id. */
export async function deleteAccesoApp(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("accesos_apps").delete().eq("id", id);
  if (error) {
    console.error("[accesos-apps] deleteAccesoApp:", error);
    throw new Error(`Error al eliminar acceso: ${error.message}`);
  }
}
