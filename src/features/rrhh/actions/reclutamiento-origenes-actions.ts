"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

export interface OrigenCandidatoConfig {
  id: string;
  nombre: string;
  activo: boolean;
  orden: number;
}

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

function mensajeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return "Error desconocido";
}

/** Lista los orígenes ("¿Cómo nos has conocido?") de la empresa activa. */
export async function listOrigenesCandidato(): Promise<OrigenCandidatoConfig[]> {
  const { supabase, empresaId } = await getContext();
  if (!empresaId) return [];
  const { data, error } = await supabase
    .from("reclutamiento_origenes")
    .select("id, nombre, activo, orden")
    .eq("empresa_id", empresaId)
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });
  if (error) {
    console.error("[rrhh] listOrigenesCandidato:", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    nombre: r.nombre as string,
    activo: !!r.activo,
    orden: (r.orden as number) ?? 0,
  }));
}

export async function createOrigenCandidato(nombre: string) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    const trimmed = nombre.trim();
    if (!trimmed) return { ok: false as const, error: "El nombre es obligatorio" };

    // Siguiente orden disponible.
    const { data: ult } = await supabase
      .from("reclutamiento_origenes")
      .select("orden")
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    const orden = ((ult?.orden as number) ?? 0) + 1;

    const { data, error } = await supabase
      .from("reclutamiento_origenes")
      .insert({ empresa_id: empresaId, nombre: trimmed, orden })
      .select("id, nombre, activo, orden")
      .single();
    if (error) throw error;
    revalidatePath("/rrhh/reclutamiento");
    return {
      ok: true as const,
      origen: {
        id: data.id as string,
        nombre: data.nombre as string,
        activo: !!data.activo,
        orden: (data.orden as number) ?? orden,
      },
    };
  } catch (err) {
    return { ok: false as const, error: mensajeError(err) };
  }
}

// Por diseño el NOMBRE de un origen es inmutable: para cambiarlo se borra y se
// crea uno nuevo (así no se reescribe el snapshot histórico de candidatos que
// ya lo eligieron). Por eso no existe renameOrigenCandidato.

export async function toggleOrigenCandidato(id: string, activo: boolean) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    const { error } = await supabase
      .from("reclutamiento_origenes")
      .update({ activo, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: mensajeError(err) };
  }
}

export async function deleteOrigenCandidato(id: string) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    const { error } = await supabase
      .from("reclutamiento_origenes")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: mensajeError(err) };
  }
}
