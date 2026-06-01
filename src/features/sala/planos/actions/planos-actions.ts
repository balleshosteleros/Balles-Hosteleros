"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  MesaPosicion,
  Plano,
} from "@/features/sala/planos/data/planos";

function rowToPlano(r: Record<string, unknown>): Plano {
  return {
    id: r.id as string,
    localId: r.local_id as string,
    nombre: r.nombre as string,
    esPrincipal: (r.es_principal as boolean) ?? false,
    fechaDesde: (r.fecha_desde as string | null) ?? null,
    fechaHasta: (r.fecha_hasta as string | null) ?? null,
    diasSemana: (r.dias_semana as number[] | null) ?? null,
    horaInicio: (r.hora_inicio as string | null) ?? null,
    horaFin: (r.hora_fin as string | null) ?? null,
    cubreComidas: (r.cubre_comidas as boolean) ?? true,
    cubreCenas: (r.cubre_cenas as boolean) ?? true,
    fechasExtra: (r.fechas_extra as string[] | null) ?? null,
    repetirAnual: (r.repetir_anual as boolean) ?? false,
    activo: (r.activo as boolean) ?? true,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export async function listPlanos(localId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("planos")
      .select("*")
      .eq("local_id", localId)
      .order("es_principal", { ascending: false })
      .order("nombre", { ascending: true });
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(rowToPlano) };
  } catch (err) {
    console.error("[planos] list:", err);
    return { ok: false, data: [] as Plano[] };
  }
}

export async function createPlano(input: {
  localId: string;
  nombre: string;
  esPrincipal?: boolean;
}) {
  try {
    const nombre = input.nombre.trim();
    if (!nombre) return { ok: false, error: "Nombre obligatorio" };
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("planos")
      .insert({
        local_id: input.localId,
        nombre,
        es_principal: input.esPrincipal ?? false,
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Ya existe un plano con ese nombre." };
      throw error;
    }
    revalidatePath("/sala/reservas");
    return { ok: true, data: rowToPlano(data) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[planos] create:", msg);
    return { ok: false, error: msg };
  }
}

export async function updatePlano(
  id: string,
  updates: Partial<Omit<Plano, "id" | "localId" | "createdAt" | "updatedAt">>,
) {
  try {
    const supabase = await createClient();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.nombre !== undefined) {
      const n = updates.nombre.trim();
      if (!n) return { ok: false, error: "Nombre obligatorio" };
      patch.nombre = n;
    }
    if (updates.esPrincipal !== undefined) patch.es_principal = updates.esPrincipal;
    if (updates.fechaDesde !== undefined) patch.fecha_desde = updates.fechaDesde;
    if (updates.fechaHasta !== undefined) patch.fecha_hasta = updates.fechaHasta;
    if (updates.diasSemana !== undefined) patch.dias_semana = updates.diasSemana;
    if (updates.horaInicio !== undefined) patch.hora_inicio = updates.horaInicio;
    if (updates.horaFin !== undefined) patch.hora_fin = updates.horaFin;
    if (updates.cubreComidas !== undefined) patch.cubre_comidas = updates.cubreComidas;
    if (updates.cubreCenas !== undefined) patch.cubre_cenas = updates.cubreCenas;
    if (updates.fechasExtra !== undefined) patch.fechas_extra = updates.fechasExtra;
    if (updates.repetirAnual !== undefined) patch.repetir_anual = updates.repetirAnual;
    if (updates.activo !== undefined) patch.activo = updates.activo;
    const { error } = await supabase.from("planos").update(patch).eq("id", id);
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Ya existe un plano con ese nombre o ya hay otro principal." };
      throw error;
    }
    revalidatePath("/sala/reservas");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[planos] update:", msg);
    return { ok: false, error: msg };
  }
}

export async function deletePlano(id: string) {
  try {
    const supabase = await createClient();
    // Bloquear si tiene salas asociadas (las salas deben pertenecer a algún plano).
    const { count, error: errCnt } = await supabase
      .from("plano_salas")
      .select("sala_id", { count: "exact", head: true })
      .eq("plano_id", id);
    if (errCnt) throw errCnt;
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: `No se puede borrar: el plano tiene ${count} sala${count === 1 ? "" : "s"} asociada${count === 1 ? "" : "s"}. Mueve las salas a otro plano antes.`,
      };
    }
    // Bloquear si es el plano principal (sería dejar el local sin plano principal).
    const { data: planoRow, error: errSel } = await supabase
      .from("planos")
      .select("es_principal")
      .eq("id", id)
      .maybeSingle();
    if (errSel) throw errSel;
    if (planoRow?.es_principal) {
      return {
        ok: false,
        error: "No se puede borrar el plano principal. Marca otro como principal antes.",
      };
    }
    const { error } = await supabase.from("planos").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/sala/reservas");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[planos] delete:", msg);
    return { ok: false, error: msg };
  }
}

// ---- PLANO_SALAS (qué salas activa el plano) ----

export async function listPlanoSalas(planoId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("plano_salas")
      .select("sala_id")
      .eq("plano_id", planoId);
    if (error) throw error;
    return { ok: true, data: (data ?? []).map((r) => r.sala_id as string) };
  } catch (err) {
    console.error("[plano_salas] list:", err);
    return { ok: false, data: [] as string[] };
  }
}

export async function togglePlanoSala(planoId: string, salaId: string, activar: boolean) {
  try {
    const supabase = await createClient();
    if (activar) {
      const { error } = await supabase
        .from("plano_salas")
        .upsert({ plano_id: planoId, sala_id: salaId }, { onConflict: "plano_id,sala_id" });
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("plano_salas")
        .delete()
        .eq("plano_id", planoId)
        .eq("sala_id", salaId);
      if (error) throw error;
    }
    revalidatePath("/sala/reservas");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[plano_salas] toggle:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Devuelve el plano principal activo del local + las posiciones de las mesas
 * de sus salas asociadas. Las posiciones viven en `mesas.x/y/rotation` —
 * el diseño es propiedad de la sala, no del plano.
 */
export async function getPlanoActivoConPosiciones(localId: string) {
  try {
    const supabase = await createClient();
    const { data: planoRow, error: errP } = await supabase
      .from("planos")
      .select("*")
      .eq("local_id", localId)
      .eq("es_principal", true)
      .eq("activo", true)
      .maybeSingle();
    if (errP) throw errP;
    if (!planoRow) return { ok: true, data: null as null | { plano: Plano; posiciones: MesaPosicion[] } };

    // Salas asociadas al plano.
    const { data: psRows, error: errPS } = await supabase
      .from("plano_salas")
      .select("sala_id")
      .eq("plano_id", planoRow.id);
    if (errPS) throw errPS;
    const salaIds = (psRows ?? []).map((r) => r.sala_id as string);
    if (salaIds.length === 0) {
      return { ok: true, data: { plano: rowToPlano(planoRow), posiciones: [] as MesaPosicion[] } };
    }

    // Mesas con posición de esas salas (vía zonas).
    const { data: mesaRows, error: errM } = await supabase
      .from("mesas")
      .select("id, x, y, rotation, zonas!inner(sala_id)")
      .in("zonas.sala_id", salaIds)
      .not("x", "is", null)
      .not("y", "is", null);
    if (errM) throw errM;
    const posiciones: MesaPosicion[] = (mesaRows ?? []).map((r) => ({
      mesaId: r.id as string,
      x: Number(r.x),
      y: Number(r.y),
      rotation: Number(r.rotation),
    }));
    return { ok: true, data: { plano: rowToPlano(planoRow), posiciones } };
  } catch (err) {
    console.error("[planos] getPlanoActivoConPosiciones:", err);
    return { ok: false, data: null as null | { plano: Plano; posiciones: MesaPosicion[] } };
  }
}
