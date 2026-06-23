"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

export interface TipoContratoRow {
  id: string;
  nombre: string;
  activo: boolean;
  orden: number;
}

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

/** Catálogo de tipos de contrato de la empresa activa. Por defecto solo los activos. */
export async function listTiposContrato(incluirInactivos = false) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [] as TipoContratoRow[] };
    let q = supabase
      .from("tipos_contrato")
      .select("id, nombre, activo, orden")
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });
    if (!incluirInactivos) q = q.eq("activo", true);
    const { data, error } = await q;
    if (error) throw error;
    return { ok: true, data: (data ?? []) as TipoContratoRow[] };
  } catch (err) {
    console.error("[rrhh] listTiposContrato:", err);
    return { ok: false, data: [] as TipoContratoRow[] };
  }
}

export async function createTipoContrato(input: { nombre: string }) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const nombre = input.nombre?.trim();
    if (!nombre) return { ok: false, error: "El nombre es obligatorio" };

    // Siguiente orden = max + 1 (los nuevos van al final).
    const { data: ult } = await supabase
      .from("tipos_contrato")
      .select("orden")
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    const orden = ((ult?.orden as number | undefined) ?? 0) + 1;

    const { data, error } = await supabase
      .from("tipos_contrato")
      .insert({ empresa_id: empresaId, nombre, orden })
      .select("id, nombre, activo, orden")
      .single();
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Ya existe un tipo de contrato con ese nombre" };
      throw error;
    }
    revalidatePath("/ajustes");
    return { ok: true, data: data as TipoContratoRow };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] createTipoContrato:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateTipoContrato(
  id: string,
  input: { nombre?: string; activo?: boolean },
) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // Nombre actual (para cascade retroactivo si se renombra).
    const { data: actual } = await supabase
      .from("tipos_contrato")
      .select("nombre")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    const nombreAnterior = (actual?.nombre as string | undefined) ?? null;

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    let nombreNuevo: string | null = null;
    if (input.nombre !== undefined) {
      const nombre = input.nombre.trim();
      if (!nombre) return { ok: false, error: "El nombre es obligatorio" };
      patch.nombre = nombre;
      nombreNuevo = nombre;
    }
    if (input.activo !== undefined) patch.activo = input.activo;

    const { error } = await supabase
      .from("tipos_contrato")
      .update(patch)
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Ya existe un tipo de contrato con ese nombre" };
      throw error;
    }

    // Cascade: al renombrar, propaga el nuevo nombre a todas las vacantes que
    // tuvieran el tipo de contrato anterior (se guarda como texto en vacantes).
    if (nombreNuevo && nombreAnterior && nombreNuevo !== nombreAnterior) {
      await supabase
        .from("vacantes")
        .update({ tipo_contrato: nombreNuevo })
        .eq("empresa_id", empresaId)
        .eq("tipo_contrato", nombreAnterior);
      revalidatePath("/rrhh/reclutamiento");
    }

    revalidatePath("/ajustes");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] updateTipoContrato:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteTipoContrato(id: string) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // Nombre del contrato (se guarda como texto en vacantes).
    const { data: tc } = await supabase
      .from("tipos_contrato")
      .select("nombre")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    const nombre = (tc?.nombre as string | undefined) ?? null;

    // No se puede borrar un tipo de contrato que esté en uso por alguna vacante.
    if (nombre) {
      const { count } = await supabase
        .from("vacantes")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("tipo_contrato", nombre);
      if ((count ?? 0) > 0) {
        return {
          ok: false,
          error: `No se puede borrar: hay ${count} vacante(s) usando este tipo de contrato. Cámbialas primero.`,
        };
      }
    }

    const { error } = await supabase
      .from("tipos_contrato")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/ajustes");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] deleteTipoContrato:", msg);
    return { ok: false, error: msg };
  }
}
