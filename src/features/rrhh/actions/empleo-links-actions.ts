"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import {
  buildEmpleoUrl,
  validarCodigo,
  type EmpleoLink,
} from "@/features/empleo-publico/data/empleo-links";
import type { OrigenCandidatura } from "@/features/rrhh/data/reclutamiento";

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null, empleoSlug: null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  let empleoSlug: string | null = null;
  if (empresaId) {
    const { data } = await supabase
      .from("empresas")
      .select("empleo_slug, slug")
      .eq("id", empresaId)
      .maybeSingle();
    empleoSlug = (data?.empleo_slug as string | null) ?? (data?.slug as string | null) ?? null;
  }
  return { supabase, user, empresaId, empleoSlug };
}

type Row = Record<string, unknown>;

function rowToLink(row: Row, empleoSlug: string | null): EmpleoLink {
  const codigo = row.codigo as string;
  return {
    id: row.id as string,
    empresaId: row.empresa_id as string,
    codigo,
    nombre: row.nombre as string,
    origenCategoria: (row.origen_categoria as OrigenCandidatura) ?? "otros",
    urlGenerada: empleoSlug ? buildEmpleoUrl(empleoSlug, codigo) : "",
    activo: row.activo as boolean,
    creadoPor: (row.creado_por as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listEmpleoLinks() {
  try {
    const { supabase, empresaId, empleoSlug } = await getCtx();
    if (!empresaId) return { ok: false, data: [] as EmpleoLink[], error: "Sin empresa" };
    const { data, error } = await supabase
      .from("empleo_links")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { ok: true, data: (data ?? []).map((r) => rowToLink(r, empleoSlug)) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return { ok: false, data: [] as EmpleoLink[], error: msg };
  }
}

export interface CreateEmpleoLinkInput {
  codigo: string;
  nombre: string;
  origenCategoria?: OrigenCandidatura;
}

export async function createEmpleoLink(input: CreateEmpleoLinkInput) {
  try {
    const v = validarCodigo(input.codigo);
    if (!v.ok) return { ok: false, error: v.error };
    const nombre = input.nombre.trim();
    if (!nombre) return { ok: false, error: "El nombre es obligatorio" };
    const { supabase, user, empresaId, empleoSlug } = await getCtx();
    if (!empresaId) return { ok: false, error: "Sin empresa" };
    const { data, error } = await supabase
      .from("empleo_links")
      .insert({
        empresa_id: empresaId,
        codigo: v.valor,
        nombre,
        origen_categoria: input.origenCategoria ?? "otros",
        creado_por: user?.id ?? null,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Ya existe un enlace con ese código" };
      throw error;
    }
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true, data: rowToLink(data, empleoSlug) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return { ok: false, error: msg };
  }
}

export async function updateEmpleoLink(
  id: string,
  updates: { codigo?: string; nombre?: string; origenCategoria?: OrigenCandidatura },
) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "Sin empresa" };
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.codigo !== undefined) {
      const v = validarCodigo(updates.codigo);
      if (!v.ok) return { ok: false, error: v.error };
      patch.codigo = v.valor;
    }
    if (updates.nombre !== undefined) {
      const nombre = updates.nombre.trim();
      if (!nombre) return { ok: false, error: "El nombre es obligatorio" };
      patch.nombre = nombre;
    }
    if (updates.origenCategoria !== undefined) patch.origen_categoria = updates.origenCategoria;
    const { error } = await supabase
      .from("empleo_links")
      .update(patch)
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Ya existe un enlace con ese código" };
      throw error;
    }
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return { ok: false, error: msg };
  }
}

export async function toggleEmpleoLink(id: string, activo: boolean) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "Sin empresa" };
    const { error } = await supabase
      .from("empleo_links")
      .update({ activo, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return { ok: false, error: msg };
  }
}

export async function deleteEmpleoLink(id: string) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "Sin empresa" };
    const { error } = await supabase
      .from("empleo_links")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return { ok: false, error: msg };
  }
}
