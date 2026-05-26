"use server";

import { createClient } from "@/lib/supabase/server";

import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
return { supabase, user, empresaId };
}

export async function listDescuentos() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("descuentos")
      .select("*")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[descuentos] listDescuentos:", err);
    return { ok: false, data: [] };
  }
}

export async function createDescuento(input: {
  nombre: string;
  tipo: string;
  valor: number;
  fecha_inicio?: string;
  fecha_fin?: string;
  activo?: boolean;
}) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("descuentos")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre,
        tipo: input.tipo,
        valor: input.valor,
        fecha_inicio: input.fecha_inicio ?? null,
        fecha_fin: input.fecha_fin ?? null,
        activo: input.activo ?? true,
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[descuentos] createDescuento:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateDescuento(
  id: string,
  input: {
    nombre?: string;
    tipo?: string;
    valor?: number;
    fecha_inicio?: string;
    fecha_fin?: string;
    activo?: boolean;
  }
) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("descuentos")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[descuentos] updateDescuento:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteDescuento(id: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("descuentos")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[descuentos] deleteDescuento:", msg);
    return { ok: false, error: msg };
  }
}
