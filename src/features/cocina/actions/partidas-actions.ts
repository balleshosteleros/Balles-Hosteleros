"use server";

import { getAppContext } from "@/lib/supabase/get-context";

export type PartidaArea = "COCINA" | "BARRA";
export type PartidaEstado = "activa" | "inactiva" | "en_revision";

export type PartidaRow = {
  id: string;
  empresa_id: string;
  nombre: string;
  area: PartidaArea;
  estado: PartidaEstado;
  responsable: string | null;
  notas: string | null;
  created_at: string;
};

export async function listPartidas() {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, data: [] as PartidaRow[], error: "No autenticado" };

    const { data, error } = await supabase
      .from("partidas")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("nombre", { ascending: true });

    if (error) throw error;
    return { ok: true, data: (data ?? []) as PartidaRow[] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[partidas] listPartidas:", msg);
    return { ok: false, data: [] as PartidaRow[], error: msg };
  }
}

export async function createPartida(input: {
  nombre: string;
  area?: PartidaArea;
  estado?: PartidaEstado;
  responsable?: string | null;
  notas?: string | null;
}) {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("partidas")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre,
        area: input.area ?? "COCINA",
        estado: input.estado ?? "activa",
        responsable: input.responsable ?? null,
        notas: input.notas ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data: data as PartidaRow };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[partidas] createPartida:", msg);
    return { ok: false, error: msg };
  }
}

export async function updatePartida(
  id: string,
  input: {
    nombre?: string;
    area?: PartidaArea;
    estado?: PartidaEstado;
    responsable?: string | null;
    notas?: string | null;
  },
) {
  try {
    const { supabase } = await getAppContext();
    const payload: Record<string, unknown> = {};
    if (input.nombre !== undefined) payload.nombre = input.nombre;
    if (input.area !== undefined) payload.area = input.area;
    if (input.estado !== undefined) payload.estado = input.estado;
    if (input.responsable !== undefined) payload.responsable = input.responsable;
    if (input.notas !== undefined) payload.notas = input.notas;

    const { error } = await supabase
      .from("partidas")
      .update(payload)
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[partidas] updatePartida:", msg);
    return { ok: false, error: msg };
  }
}

export async function deletePartida(id: string) {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase.from("partidas").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[partidas] deletePartida:", msg);
    return { ok: false, error: msg };
  }
}
