"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  FORMAS_MESA,
  MESA_CODIGO_REGEX,
  type FormaMesa,
  type Mesa,
  type TipoMesa,
} from "@/features/sala/planos/data/planos";

function rowToMesa(r: Record<string, unknown>): Mesa {
  return {
    id: r.id as string,
    localId: r.local_id as string,
    zonaId: r.zona_id as string,
    codigo: r.codigo as string,
    capacidadMin: (r.capacidad_min as number) ?? 1,
    capacidadMax: (r.capacidad_max as number) ?? 100,
    tipo: (r.tipo as TipoMesa) ?? "BAJA",
    forma: (r.forma as FormaMesa) ?? "cuadrada",
    activa: (r.activa as boolean) ?? true,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function validarInput(input: {
  codigo: string;
  capacidadMin: number;
  capacidadMax: number;
}): string | null {
  const codigo = input.codigo.trim().toUpperCase();
  if (!MESA_CODIGO_REGEX.test(codigo)) {
    return "El código empieza por letra y admite solo letras y números (ej: A5, TE12, CR3). Máximo 6 caracteres.";
  }
  if (!Number.isInteger(input.capacidadMin) || input.capacidadMin < 1) {
    return "La capacidad mínima debe ser >= 1.";
  }
  if (!Number.isInteger(input.capacidadMax) || input.capacidadMax > 100) {
    return "La capacidad máxima debe ser <= 100.";
  }
  if (input.capacidadMin > input.capacidadMax) {
    return "La capacidad mínima no puede ser mayor que la máxima.";
  }
  return null;
}

export async function listMesas(localId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mesas")
      .select("*")
      .eq("local_id", localId)
      .order("codigo", { ascending: true });
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(rowToMesa) };
  } catch (err) {
    console.error("[mesas] list:", err);
    return { ok: false, data: [] as Mesa[] };
  }
}

export async function createMesa(input: {
  localId: string;
  zonaId: string;
  codigo: string;
  capacidadMin?: number;
  capacidadMax?: number;
  tipo?: TipoMesa;
}) {
  try {
    if (!input.zonaId) return { ok: false, error: "Zona obligatoria" };
    const capMin = input.capacidadMin ?? 1;
    const capMax = input.capacidadMax ?? 100;
    const err = validarInput({ codigo: input.codigo, capacidadMin: capMin, capacidadMax: capMax });
    if (err) return { ok: false, error: err };
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mesas")
      .insert({
        local_id: input.localId,
        zona_id: input.zonaId,
        codigo: input.codigo.trim().toUpperCase(),
        capacidad_min: capMin,
        capacidad_max: capMax,
        tipo: input.tipo ?? "BAJA",
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Ya existe una mesa con ese código en este local." };
      throw error;
    }
    revalidatePath("/sala/reservas");
    return { ok: true, data: rowToMesa(data) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[mesas] create:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateMesa(
  id: string,
  updates: {
    zonaId?: string;
    codigo?: string;
    capacidadMin?: number;
    capacidadMax?: number;
    tipo?: TipoMesa;
    forma?: FormaMesa;
    activa?: boolean;
  },
) {
  try {
    const supabase = await createClient();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.zonaId !== undefined) patch.zona_id = updates.zonaId;
    if (updates.codigo !== undefined) {
      const codigo = updates.codigo.trim().toUpperCase();
      if (!MESA_CODIGO_REGEX.test(codigo)) {
        return { ok: false, error: "El código empieza por letra y admite solo letras y números (ej: A5, TE12). Máximo 6 caracteres." };
      }
      patch.codigo = codigo;
    }
    if (updates.capacidadMin !== undefined || updates.capacidadMax !== undefined) {
      const { data: actual } = await supabase
        .from("mesas")
        .select("capacidad_min, capacidad_max")
        .eq("id", id)
        .maybeSingle();
      const capMin = updates.capacidadMin ?? (actual?.capacidad_min as number) ?? 1;
      const capMax = updates.capacidadMax ?? (actual?.capacidad_max as number) ?? 100;
      if (capMin < 1 || capMax > 100 || capMin > capMax) {
        return { ok: false, error: "Capacidad inválida (1 <= min <= max <= 100)." };
      }
      if (updates.capacidadMin !== undefined) patch.capacidad_min = capMin;
      if (updates.capacidadMax !== undefined) patch.capacidad_max = capMax;
    }
    if (updates.tipo !== undefined) patch.tipo = updates.tipo;
    if (updates.forma !== undefined) {
      if (!FORMAS_MESA.includes(updates.forma)) {
        return { ok: false, error: "Forma de mesa inválida." };
      }
      patch.forma = updates.forma;
    }
    if (updates.activa !== undefined) patch.activa = updates.activa;

    const { error } = await supabase.from("mesas").update(patch).eq("id", id);
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Ya existe una mesa con ese código en este local." };
      throw error;
    }
    revalidatePath("/sala/reservas");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[mesas] update:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteMesa(id: string) {
  try {
    const supabase = await createClient();

    // Bloquea el borrado si la mesa tiene reservas futuras vivas o tickets POS abiertos.
    // reservas.mesa es texto (código), no FK → comparamos contra el código actual de la mesa.
    const { data: mesa } = await supabase
      .from("mesas")
      .select("codigo")
      .eq("id", id)
      .maybeSingle();
    if (!mesa) return { ok: false, error: "La mesa ya no existe." };
    const codigo = mesa.codigo as string;

    const today = new Date().toISOString().slice(0, 10);
    const { count: reservasFuturas } = await supabase
      .from("reservas")
      .select("id", { count: "exact", head: true })
      .eq("mesa", codigo)
      .gte("fecha", today)
      .not("estado", "in", "(CANCELADA,NO_SHOW,COMPLETADA,LIBERADA)");
    if ((reservasFuturas ?? 0) > 0) {
      return {
        ok: false,
        error: `No se puede borrar: la mesa ${codigo} tiene ${reservasFuturas} reserva(s) futura(s) activa(s). Reasigna o cancela antes.`,
      };
    }

    const { count: ticketsAbiertos } = await supabase
      .from("pos_tickets")
      .select("id", { count: "exact", head: true })
      .eq("mesa_id", id)
      .in("estado", ["ABIERTO", "ENVIADO"]);
    if ((ticketsAbiertos ?? 0) > 0) {
      return {
        ok: false,
        error: `No se puede borrar: la mesa ${codigo} tiene un ticket POS abierto. Cierra el ticket antes.`,
      };
    }

    const { error } = await supabase.from("mesas").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        return { ok: false, error: "La mesa está referenciada por otros registros y no se puede borrar." };
      }
      throw error;
    }
    revalidatePath("/sala/reservas");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[mesas] delete:", msg);
    return { ok: false, error: msg };
  }
}
