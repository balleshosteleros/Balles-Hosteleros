"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
export type EtiquetaTipo =
  | "CATEGORIA"
  | "ALERTA"
  | "INGRESO"
  | "DEPARTAMENTO"
  | "EMPLEADO"
  | "INFORME"
  | "ESTADISTICA"
  | "PATRIMONIO";

export type EtiquetaRow = {
  id: string;
  empresa_id: string;
  parent_id: string | null;
  nombre: string;
  emoji: string | null;
  color: string | null;
  descripcion: string | null;
  orden: number;
  activa: boolean;
  tipo: EtiquetaTipo;
  created_at: string;
};

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
return { supabase, user, empresaId };
}

export async function listEtiquetas() {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, data: [] as EtiquetaRow[] };
    const { data, error } = await supabase
      .from("etiquetas")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("parent_id", { ascending: true, nullsFirst: true })
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });
    if (error) throw error;
    return { ok: true as const, data: (data ?? []) as EtiquetaRow[] };
  } catch (err) {
    console.error("[etiquetas] list:", err);
    return { ok: false as const, data: [] as EtiquetaRow[] };
  }
}

export async function createEtiqueta(input: {
  nombre: string;
  parent_id?: string | null;
  emoji?: string | null;
  color?: string | null;
  tipo?: EtiquetaTipo;
}) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    const nombre = input.nombre.trim();
    if (!nombre) return { ok: false as const, error: "Nombre vacío" };

    let tipo: EtiquetaTipo = input.tipo ?? "CATEGORIA";
    if (input.parent_id) {
      const { data: parent } = await supabase
        .from("etiquetas")
        .select("tipo")
        .eq("id", input.parent_id)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (parent?.tipo) tipo = parent.tipo as EtiquetaTipo;
    }

    const { data: maxRow } = await supabase
      .from("etiquetas")
      .select("orden")
      .eq("empresa_id", empresaId)
      .eq("tipo", tipo)
      .is("parent_id", input.parent_id ?? null)
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrden = (maxRow?.orden ?? -1) + 1;

    const { data, error } = await supabase
      .from("etiquetas")
      .insert({
        empresa_id: empresaId,
        nombre,
        parent_id: input.parent_id ?? null,
        emoji: input.emoji ?? null,
        color: input.color ?? null,
        orden: nextOrden,
        tipo,
      })
      .select()
      .single();
    if (error) throw error;
    revalidatePath("/contabilidad/etiquetas");
    return { ok: true as const, data: data as EtiquetaRow };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[etiquetas] create:", msg);
    return { ok: false as const, error: msg };
  }
}

export async function updateEtiqueta(
  id: string,
  input: { nombre?: string; emoji?: string | null; color?: string | null }
) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    const patch: Record<string, unknown> = {};
    if (input.nombre !== undefined) patch.nombre = input.nombre.trim();
    if (input.emoji !== undefined) patch.emoji = input.emoji;
    if (input.color !== undefined) patch.color = input.color;
    if (Object.keys(patch).length === 0) return { ok: true as const };

    const { error } = await supabase
      .from("etiquetas")
      .update(patch)
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/contabilidad/etiquetas");
    return { ok: true as const };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[etiquetas] update:", msg);
    return { ok: false as const, error: msg };
  }
}

export async function deleteEtiqueta(id: string) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    const { error } = await supabase
      .from("etiquetas")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/contabilidad/etiquetas");
    return { ok: true as const };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[etiquetas] delete:", msg);
    return { ok: false as const, error: msg };
  }
}

export async function moveEtiqueta(input: {
  id: string;
  parent_id: string | null;
  orden?: number;
}) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };

    let orden = input.orden;
    if (orden === undefined) {
      const { data: maxRow } = await supabase
        .from("etiquetas")
        .select("orden")
        .eq("empresa_id", empresaId)
        .is("parent_id", input.parent_id)
        .neq("id", input.id)
        .order("orden", { ascending: false })
        .limit(1)
        .maybeSingle();
      orden = (maxRow?.orden ?? -1) + 1;
    }

    const { error } = await supabase
      .from("etiquetas")
      .update({ parent_id: input.parent_id, orden })
      .eq("id", input.id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/contabilidad/etiquetas");
    return { ok: true as const };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[etiquetas] move:", msg);
    return { ok: false as const, error: msg };
  }
}

export async function reorderEtiquetas(
  items: { id: string; orden: number; parent_id: string | null }[]
) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    for (const it of items) {
      const { error } = await supabase
        .from("etiquetas")
        .update({ orden: it.orden, parent_id: it.parent_id })
        .eq("id", it.id)
        .eq("empresa_id", empresaId);
      if (error) throw error;
    }
    revalidatePath("/contabilidad/etiquetas");
    return { ok: true as const };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[etiquetas] reorder:", msg);
    return { ok: false as const, error: msg };
  }
}
