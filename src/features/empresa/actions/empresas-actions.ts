"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DatosGenerales, ConfigOperativa } from "@/features/ajustes/data/ajustes";
import { seedEmpresaDefaults } from "@/lib/seeds/sync";

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
  emailContacto?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const updates: Record<string, unknown> = {};
    if (input.datosGenerales !== undefined) updates.datos_generales = input.datosGenerales;
    if (input.configOperativa !== undefined) updates.config_operativa = input.configOperativa;
    if (input.emailContacto !== undefined) updates.email_contacto = input.emailContacto;
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

export async function getEmpresaEmailContacto(
  empresaId: string,
): Promise<{ ok: true; email: string | null } | { ok: false; error: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("empresas")
      .select("email_contacto")
      .eq("id", empresaId)
      .maybeSingle();
    if (error) throw error;
    return { ok: true, email: (data?.email_contacto as string | null) ?? null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[empresas] getEmailContacto:", msg);
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

    // Siembra desde el manifiesto canónico del software (src/lib/seeds).
    // Si falla, NO revertimos la empresa — el dueño puede re-ejecutar el sync.
    try {
      await seedEmpresaDefaults(nueva.id, nueva.slug);
    } catch (seedErr) {
      console.error("[empresas] seedEmpresaDefaults:", seedErr);
    }

    return { ok: true, data: nueva };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[empresas] create:", msg);
    return { ok: false, error: msg };
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
