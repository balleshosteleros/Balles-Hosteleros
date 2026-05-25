"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DatosGenerales, ConfigOperativa } from "@/features/ajustes/data/ajustes";

export interface EmpresaIdentidad {
  id: string;
  slug: string;
  nombre: string;
  iniciales: string | null;
  color: string | null;
  estado: string;
}

export interface EmpresaCompleta extends EmpresaIdentidad {
  datosGenerales: Partial<DatosGenerales>;
  configOperativa: Partial<ConfigOperativa>;
  logoUrl: string | null;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function listEmpresasCompletas(): Promise<EmpresaCompleta[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresas")
    .select("id, slug, nombre, iniciales, color, estado, datos_generales, config_operativa, logo_url")
    .eq("is_demo", false)
    .order("nombre", { ascending: true });

  if (error) {
    console.error("[empresas] list:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    slug: (row.slug as string) ?? slugify((row.nombre as string) ?? row.id),
    nombre: (row.nombre as string) ?? "",
    iniciales: (row.iniciales as string) ?? null,
    color: (row.color as string) ?? null,
    estado: (row.estado as string) ?? "Activa",
    datosGenerales: (row.datos_generales as Partial<DatosGenerales>) ?? {},
    configOperativa: (row.config_operativa as Partial<ConfigOperativa>) ?? {},
    logoUrl: (row.logo_url as string) ?? null,
  }));
}

export async function saveEmpresaIdentidad(input: {
  id: string;
  nombre?: string;
  iniciales?: string;
  color?: string;
  estado?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const updates: Record<string, unknown> = {};
    // Slug es FK estable; nunca se regenera en updates.
    if (input.nombre !== undefined) updates.nombre = input.nombre;
    if (input.iniciales !== undefined) updates.iniciales = input.iniciales;
    if (input.color !== undefined) updates.color = input.color;
    if (input.estado !== undefined) updates.estado = input.estado;

    if (Object.keys(updates).length === 0) return { ok: true };

    const { error } = await supabase.from("empresas").update(updates).eq("id", input.id);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[empresas] saveIdentidad:", msg);
    return { ok: false, error: msg };
  }
}

export async function saveEmpresaAjustes(input: {
  id: string;
  datosGenerales?: Partial<DatosGenerales>;
  configOperativa?: Partial<ConfigOperativa>;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const updates: Record<string, unknown> = {};
    if (input.datosGenerales !== undefined) updates.datos_generales = input.datosGenerales;
    if (input.configOperativa !== undefined) updates.config_operativa = input.configOperativa;
    // Fuente de verdad: nombreComercial manda sobre empresas.nombre.
    const nc = input.datosGenerales?.nombreComercial?.trim();
    if (nc) updates.nombre = nc;

    if (Object.keys(updates).length === 0) return { ok: true };

    const { error } = await supabase.from("empresas").update(updates).eq("id", input.id);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[empresas] saveAjustes:", msg);
    return { ok: false, error: msg };
  }
}

export async function createEmpresa(input: {
  nombre: string;
  iniciales: string;
  color: string;
}): Promise<{ ok: boolean; data?: EmpresaIdentidad; error?: string }> {
  try {
    const admin = createAdminClient();
    const slug = slugify(input.nombre);
    const { data, error } = await admin
      .from("empresas")
      .insert({
        nombre: input.nombre,
        slug,
        iniciales: input.iniciales,
        color: input.color,
        datos_generales: { nombreComercial: input.nombre },
      })
      .select("id, slug, nombre, iniciales, color, estado")
      .single();
    if (error) throw error;

    const nueva: EmpresaIdentidad = {
      id: data.id as string,
      slug: data.slug as string,
      nombre: data.nombre as string,
      iniciales: data.iniciales as string,
      color: data.color as string,
      estado: data.estado as string,
    };

    // Siembra automática usando BACANAL como plantilla universal:
    // departamentos + roles + organigrama + vacantes en borrador.
    // Si falla, NO revertimos la empresa — el dueño puede sembrar manualmente.
    try {
      await seedEmpresaDesdeBacanal(admin, nueva.id, nueva.slug);
    } catch (seedErr) {
      console.error("[empresas] seedEmpresaDesdeBacanal:", seedErr);
    }

    return { ok: true, data: nueva };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[empresas] create:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Siembra una empresa recién creada con la plantilla de BACANAL:
 * departamentos, roles (con mapeo de departamento_id), organigrama
 * (nodes/edges/zones) y vacantes en borrador a partir de los nodos.
 *
 * Idempotente: si ya existen departamentos/roles/organigrama para la
 * empresa, se omiten para no duplicar.
 */
async function seedEmpresaDesdeBacanal(
  admin: ReturnType<typeof createAdminClient>,
  empresaId: string,
  empresaSlug: string,
): Promise<void> {
  // 1. Localizar BACANAL
  const { data: bacanal } = await admin
    .from("empresas")
    .select("id, slug")
    .eq("slug", "bacanal")
    .maybeSingle();
  if (!bacanal) return;
  const bacanalId = bacanal.id as string;
  const bacanalSlug = bacanal.slug as string;

  // 2. Clonar departamentos
  const { data: deptosOrig } = await admin
    .from("departamentos")
    .select("nombre, descripcion, estado")
    .eq("empresa_id", bacanalId);
  const deptosACrear = (deptosOrig ?? []).map((d) => ({
    empresa_id: empresaId,
    nombre: d.nombre as string,
    descripcion: (d.descripcion as string) ?? "",
    estado: (d.estado as string) ?? "activo",
  }));
  let deptosCreados: Array<{ id: string; nombre: string }> = [];
  if (deptosACrear.length > 0) {
    const { data } = await admin
      .from("departamentos")
      .insert(deptosACrear)
      .select("id, nombre");
    deptosCreados = (data ?? []) as Array<{ id: string; nombre: string }>;
  }
  const deptoIdPorNombre = new Map(
    deptosCreados.map((d) => [d.nombre.trim().toUpperCase(), d.id]),
  );

  // 3. Clonar empresa_roles, remapeando departamento_id por nombre.
  const { data: rolesOrig } = await admin
    .from("empresa_roles")
    .select("nombre, descripcion, permisos, protected, departamento_id")
    .eq("empresa_id", bacanalId);

  // Para remapear departamento_id necesitamos el nombre del depto original.
  const { data: deptosOrigConId } = await admin
    .from("departamentos")
    .select("id, nombre")
    .eq("empresa_id", bacanalId);
  const nombreDeptoOrigPorId = new Map(
    ((deptosOrigConId ?? []) as Array<{ id: string; nombre: string }>).map(
      (d) => [d.id, d.nombre.trim().toUpperCase()],
    ),
  );

  const rolesACrear = (rolesOrig ?? []).map((r) => {
    const deptoOrigId = (r.departamento_id as string | null) ?? null;
    const nombreDepto = deptoOrigId ? nombreDeptoOrigPorId.get(deptoOrigId) : null;
    const nuevoDeptoId = nombreDepto ? deptoIdPorNombre.get(nombreDepto) ?? null : null;
    return {
      empresa_id: empresaId,
      nombre: r.nombre as string,
      descripcion: (r.descripcion as string) ?? "",
      permisos: r.permisos ?? [],
      protected: (r.protected as boolean) ?? false,
      departamento_id: nuevoDeptoId,
    };
  });
  if (rolesACrear.length > 0) {
    await admin.from("empresa_roles").insert(rolesACrear);
  }

  // 4. Clonar organigrama (1 fila por empresa_slug).
  const { data: orgOrig } = await admin
    .from("organigramas")
    .select("nodes, edges, zones")
    .eq("empresa_slug", bacanalSlug)
    .maybeSingle();
  if (orgOrig) {
    await admin.from("organigramas").upsert({
      empresa_slug: empresaSlug,
      nodes: orgOrig.nodes ?? [],
      edges: orgOrig.edges ?? [],
      zones: orgOrig.zones ?? [],
      updated_at: new Date().toISOString(),
    });
  }

  // 5. Vacantes en borrador a partir de los nodos del organigrama (1 por puesto).
  const nodos = (orgOrig?.nodes ?? []) as Array<{ id: string; label: string }>;
  if (nodos.length > 0) {
    const vistos = new Set<string>();
    const vacantes = nodos
      .filter((n) => {
        const key = (n.label ?? "").trim().toLowerCase();
        if (!key || vistos.has(key)) return false;
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
    if (vacantes.length > 0) {
      await admin.from("vacantes").insert(vacantes);
    }
  }
}

export async function deleteEmpresa(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("empresas").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[empresas] delete:", msg);
    return { ok: false, error: msg };
  }
}
