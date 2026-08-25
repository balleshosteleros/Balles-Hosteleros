"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  type MesaCombinacion,
  type MesaCombinacionComponente,
  type TipoMesa,
} from "@/features/sala/planos/data/planos";

function rowToCombinacion(r: Record<string, unknown>): MesaCombinacion {
  return {
    id: r.id as string,
    localId: r.local_id as string,
    codigo: r.codigo as string,
    capacidadAuto: (r.capacidad_auto as boolean) ?? true,
    capacidadMin: (r.capacidad_min as number) ?? 1,
    capacidadMax: (r.capacidad_max as number) ?? 100,
    zonaId: (r.zona_id as string | null) ?? null,
    tipo: (r.tipo as TipoMesa | null) ?? null,
    colorMarca: r.color_marca as string,
    activa: (r.activa as boolean) ?? true,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export async function listCombinaciones(localId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mesa_combinaciones")
      .select("*")
      .eq("local_id", localId)
      .order("codigo", { ascending: true });
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(rowToCombinacion) };
  } catch (err) {
    console.error("[combinaciones] list:", err);
    return { ok: false, data: [] as MesaCombinacion[] };
  }
}

export async function listComponentes(combinacionId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mesa_combinacion_componentes")
      .select("combinacion_id, mesa_id, orden")
      .eq("combinacion_id", combinacionId)
      .order("orden", { ascending: true });
    if (error) throw error;
    return {
      ok: true,
      data: (data ?? []).map((r) => ({
        combinacionId: r.combinacion_id as string,
        mesaId: r.mesa_id as string,
        orden: r.orden as number,
      })) as MesaCombinacionComponente[],
    };
  } catch (err) {
    console.error("[combinaciones] listComponentes:", err);
    return { ok: false, data: [] as MesaCombinacionComponente[] };
  }
}

/**
 * Componentes de TODAS las combinaciones del local, de una sola consulta.
 * Evita el N+1 cuando hay que resolver la composición de muchas uniones a la
 * vez (por ejemplo para saber en qué zona cae cada una).
 */
export async function listComponentesTodas(localId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mesa_combinacion_componentes")
      .select("combinacion_id, mesa_id, orden, mesa_combinaciones!inner(local_id)")
      .eq("mesa_combinaciones.local_id", localId)
      .order("orden", { ascending: true });
    if (error) throw error;
    return {
      ok: true,
      data: (data ?? []).map((r) => ({
        combinacionId: r.combinacion_id as string,
        mesaId: r.mesa_id as string,
        orden: r.orden as number,
      })) as MesaCombinacionComponente[],
    };
  } catch (err) {
    console.error("[combinaciones] listComponentesTodas:", err);
    return { ok: false, data: [] as MesaCombinacionComponente[] };
  }
}

export async function createCombinacion(input: {
  localId: string;
  mesaIds: string[];
  capacidadAuto: boolean;
  capacidadMin: number;
  capacidadMax: number;
  zonaId: string | null;
  tipo: TipoMesa | null;
  colorMarca: string;
}) {
  try {
    if (input.mesaIds.length < 2) {
      return { ok: false, error: "Una combinación necesita al menos 2 mesas." };
    }
    if (
      input.capacidadMin < 1 ||
      input.capacidadMax > 100 ||
      input.capacidadMin > input.capacidadMax
    ) {
      return { ok: false, error: "Capacidad inválida (1 <= min <= max <= 100)." };
    }
    const supabase = await createClient();

    // Una combinación solo tiene sentido dentro de una zona: juntar una mesa
    // de terraza con otra de sala no se puede montar físicamente. Se valida en
    // servidor porque la UI puede saltarse (o quedarse desactualizada).
    const errZona = await validarMismaZona(supabase, input.mesaIds);
    if (errZona) return { ok: false, error: errZona };

    const { data: comb, error } = await supabase
      .from("mesa_combinaciones")
      .insert({
        local_id: input.localId,
        capacidad_auto: input.capacidadAuto,
        capacidad_min: input.capacidadMin,
        capacidad_max: input.capacidadMax,
        zona_id: input.zonaId,
        tipo: input.tipo,
        color_marca: input.colorMarca,
      })
      .select("*")
      .single();
    if (error) throw error;

    // Insertar componentes (trigger recalcula codigo y, si auto, capacidades)
    const componentes = input.mesaIds.map((mesaId, idx) => ({
      combinacion_id: comb.id as string,
      mesa_id: mesaId,
      orden: idx + 1,
    }));
    const { error: errComp } = await supabase
      .from("mesa_combinacion_componentes")
      .insert(componentes);
    if (errComp) {
      // Rollback manual
      await supabase.from("mesa_combinaciones").delete().eq("id", comb.id as string);
      if (errComp.code === "23505") {
        return { ok: false, error: "Esta combinación ya existe (mismo conjunto de mesas)." };
      }
      throw errComp;
    }

    revalidatePath("/sala/reservas");
    return { ok: true, id: comb.id as string };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[combinaciones] create:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateCombinacion(
  id: string,
  updates: {
    mesaIds?: string[];
    capacidadAuto?: boolean;
    capacidadMin?: number;
    capacidadMax?: number;
    zonaId?: string | null;
    tipo?: TipoMesa | null;
    colorMarca?: string;
    activa?: boolean;
  },
) {
  try {
    const supabase = await createClient();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.capacidadAuto !== undefined) patch.capacidad_auto = updates.capacidadAuto;
    if (updates.capacidadMin !== undefined) patch.capacidad_min = updates.capacidadMin;
    if (updates.capacidadMax !== undefined) patch.capacidad_max = updates.capacidadMax;
    if (updates.zonaId !== undefined) patch.zona_id = updates.zonaId;
    if (updates.tipo !== undefined) patch.tipo = updates.tipo;
    if (updates.colorMarca !== undefined) patch.color_marca = updates.colorMarca;
    if (updates.activa !== undefined) patch.activa = updates.activa;
    const { error } = await supabase.from("mesa_combinaciones").update(patch).eq("id", id);
    if (error) throw error;

    // Si cambian los componentes, reemplazamos completos (más simple que diff)
    if (updates.mesaIds !== undefined) {
      if (updates.mesaIds.length < 2) {
        return { ok: false, error: "Una combinación necesita al menos 2 mesas." };
      }
      // Misma regla que al crear: no se pueden mezclar zonas.
      const errZona = await validarMismaZona(supabase, updates.mesaIds);
      if (errZona) return { ok: false, error: errZona };
      await supabase.from("mesa_combinacion_componentes").delete().eq("combinacion_id", id);
      const componentes = updates.mesaIds.map((mesaId, idx) => ({
        combinacion_id: id,
        mesa_id: mesaId,
        orden: idx + 1,
      }));
      const { error: errComp } = await supabase
        .from("mesa_combinacion_componentes")
        .insert(componentes);
      if (errComp) throw errComp;
    }

    revalidatePath("/sala/reservas");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[combinaciones] update:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteCombinacion(id: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("mesa_combinaciones").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/sala/reservas");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[combinaciones] delete:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Todas las mesas de una combinación deben ser de la MISMA zona.
 *
 * Juntar una mesa de terraza con una de sala no se puede montar en la
 * realidad, y si el motor la asignara aceptaría un grupo que luego no cabe.
 *
 * Devuelve el mensaje de error, o null si es válida.
 */
async function validarMismaZona(
  supabase: Awaited<ReturnType<typeof createClient>>,
  mesaIds: string[],
): Promise<string | null> {
  const { data, error } = await supabase
    .from("mesas")
    .select("zona_id, zonas!inner(nombre)")
    .in("id", mesaIds);
  if (error || !data || data.length === 0) return null; // no bloquear por un fallo de lectura

  const zonas = new Set(data.map((m) => m.zona_id as string));
  if (zonas.size <= 1) return null;

  const nombres = [
    ...new Set(
      data.map((m) => {
        const z = m.zonas as unknown as { nombre?: string } | { nombre?: string }[];
        return Array.isArray(z) ? (z[0]?.nombre ?? "") : (z?.nombre ?? "");
      }),
    ),
  ].filter(Boolean);

  return `Solo se pueden combinar mesas de la misma zona (has elegido ${nombres.join(" y ")}).`;
}
