"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Sala } from "@/features/sala/planos/data/planos";

function rowToSala(r: Record<string, unknown>): Sala {
  return {
    id: r.id as string,
    localId: r.local_id as string,
    nombre: r.nombre as string,
    orden: (r.orden as number) ?? 0,
    esPrincipal: (r.es_principal as boolean) ?? false,
    createdAt: r.created_at as string,
  };
}

export async function listSalas(localId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("salas")
      .select("*")
      .eq("local_id", localId)
      .order("es_principal", { ascending: false })
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(rowToSala) };
  } catch (err) {
    console.error("[salas] list:", err);
    return { ok: false, data: [] as Sala[] };
  }
}

export async function setSalaPrincipal(id: string) {
  try {
    const supabase = await createClient();
    const { data: sala, error: errSel } = await supabase
      .from("salas")
      .select("local_id")
      .eq("id", id)
      .single();
    if (errSel) throw errSel;
    const localId = (sala as { local_id: string }).local_id;
    const { error: errClr } = await supabase
      .from("salas")
      .update({ es_principal: false })
      .eq("local_id", localId)
      .eq("es_principal", true);
    if (errClr) throw errClr;
    const { error: errSet } = await supabase
      .from("salas")
      .update({ es_principal: true })
      .eq("id", id);
    if (errSet) throw errSet;
    revalidatePath("/sala/reservas");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[salas] setSalaPrincipal:", msg);
    return { ok: false, error: msg };
  }
}

export async function createSala(input: { localId: string; nombre: string; orden?: number }) {
  try {
    const nombre = input.nombre.trim();
    if (!nombre) return { ok: false, error: "Nombre obligatorio" };
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("salas")
      .insert({
        local_id: input.localId,
        nombre,
        orden: input.orden ?? 0,
      })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/sala/reservas");
    return { ok: true, data: rowToSala(data) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[salas] create:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateSala(id: string, updates: { nombre?: string; orden?: number }) {
  try {
    const patch: Record<string, unknown> = {};
    if (updates.nombre !== undefined) {
      const n = updates.nombre.trim();
      if (!n) return { ok: false, error: "Nombre obligatorio" };
      patch.nombre = n;
    }
    if (updates.orden !== undefined) patch.orden = updates.orden;
    const supabase = await createClient();
    const { error } = await supabase.from("salas").update(patch).eq("id", id);
    if (error) throw error;
    revalidatePath("/sala/reservas");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[salas] update:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteSala(id: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("salas").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        return {
          ok: false,
          error: "No se puede borrar: la sala tiene zonas asociadas. Borra las zonas primero.",
        };
      }
      throw error;
    }
    revalidatePath("/sala/reservas");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[salas] delete:", msg);
    return { ok: false, error: msg };
  }
}
