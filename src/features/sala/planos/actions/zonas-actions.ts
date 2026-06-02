"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Zona } from "@/features/sala/planos/data/planos";

function rowToZona(r: Record<string, unknown>): Zona {
  return {
    id: r.id as string,
    localId: r.local_id as string,
    salaId: r.sala_id as string,
    nombre: r.nombre as string,
    colorPastel: (r.color_pastel as string) ?? "#FDE68A",
    visibleCliente: (r.visible_cliente as boolean) ?? true,
    zonaPublicaId: (r.zona_publica_id as string | null) ?? null,
    ocultaTotal: (r.oculta_total as boolean) ?? false,
    orden: (r.orden as number) ?? 0,
    etiquetaX: r.etiqueta_x === null || r.etiqueta_x === undefined ? null : Number(r.etiqueta_x),
    etiquetaY: r.etiqueta_y === null || r.etiqueta_y === undefined ? null : Number(r.etiqueta_y),
    createdAt: r.created_at as string,
  };
}

export async function listZonas(localId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("zonas")
      .select("*")
      .eq("local_id", localId)
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(rowToZona) };
  } catch (err) {
    console.error("[zonas] list:", err);
    return { ok: false, data: [] as Zona[] };
  }
}

export async function createZona(input: {
  localId: string;
  salaId: string;
  nombre: string;
  colorPastel?: string;
  orden?: number;
}) {
  try {
    const nombre = input.nombre.trim();
    if (!nombre) return { ok: false, error: "Nombre obligatorio" };
    if (!input.salaId) return { ok: false, error: "Sala obligatoria" };
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("zonas")
      .insert({
        local_id: input.localId,
        sala_id: input.salaId,
        nombre,
        color_pastel: input.colorPastel ?? "#FDE68A",
        orden: input.orden ?? 0,
      })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/sala/reservas");
    return { ok: true, data: rowToZona(data) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[zonas] create:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateZona(
  id: string,
  updates: {
    nombre?: string;
    salaId?: string;
    colorPastel?: string;
    visibleCliente?: boolean;
    zonaPublicaId?: string | null;
    ocultaTotal?: boolean;
    orden?: number;
    etiquetaX?: number | null;
    etiquetaY?: number | null;
  },
) {
  try {
    const patch: Record<string, unknown> = {};
    if (updates.nombre !== undefined) {
      const n = updates.nombre.trim();
      if (!n) return { ok: false, error: "Nombre obligatorio" };
      patch.nombre = n;
    }
    if (updates.salaId !== undefined) patch.sala_id = updates.salaId;
    if (updates.colorPastel !== undefined) patch.color_pastel = updates.colorPastel;
    if (updates.visibleCliente !== undefined) patch.visible_cliente = updates.visibleCliente;
    if (updates.zonaPublicaId !== undefined) patch.zona_publica_id = updates.zonaPublicaId;
    if (updates.ocultaTotal !== undefined) patch.oculta_total = updates.ocultaTotal;
    if (updates.orden !== undefined) patch.orden = updates.orden;
    if (updates.etiquetaX !== undefined) patch.etiqueta_x = updates.etiquetaX;
    if (updates.etiquetaY !== undefined) patch.etiqueta_y = updates.etiquetaY;
    if (Object.keys(patch).length === 0) return { ok: true };
    const supabase = await createClient();
    const { error } = await supabase.from("zonas").update(patch).eq("id", id);
    if (error) throw error;
    revalidatePath("/sala/reservas");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[zonas] update:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteZona(id: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("zonas").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        return {
          ok: false,
          error: "No se puede borrar: la zona tiene mesas asociadas. Borra las mesas primero.",
        };
      }
      throw error;
    }
    revalidatePath("/sala/reservas");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[zonas] delete:", msg);
    return { ok: false, error: msg };
  }
}
