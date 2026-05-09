"use server";

import { getAppContext } from "@/lib/supabase/get-context";

// ─── Types ─────────────────────────────────────────────────────────────
export type TipoAusenciaRow = {
  id: string;
  empresa_id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string;
  color: string;
  requiere_aprobacion: boolean;
  requiere_justificante: boolean;
  descuenta_jornada: boolean;
  refleja_calendario: boolean;
  orden: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type TipoFichajeRow = {
  id: string;
  empresa_id: string;
  nombre: string;
  codigo: string;
  descripcion: string | null;
  computa_tiempo: boolean;
  orden: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type TipoAusenciaInput = {
  nombre: string;
  descripcion?: string | null;
  categoria?: string;
  color?: string;
  requiere_aprobacion?: boolean;
  requiere_justificante?: boolean;
  descuenta_jornada?: boolean;
  refleja_calendario?: boolean;
  activo?: boolean;
};

export type TipoFichajeInput = {
  nombre: string;
  codigo: string;
  descripcion?: string | null;
  computa_tiempo?: boolean;
  activo?: boolean;
};

// ─── Helpers ───────────────────────────────────────────────────────────
async function nextOrden(table: "tipos_ausencia" | "tipos_fichaje", empresaId: string) {
  const { supabase } = await getAppContext();
  const { data } = await supabase
    .from(table)
    .select("orden")
    .eq("empresa_id", empresaId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data?.orden as number | undefined) ?? 0) + 1;
}

// ─── TIPOS AUSENCIA ────────────────────────────────────────────────────
export async function listTiposAusencia() {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, data: [] as TipoAusenciaRow[], error: "No autenticado" };

    const { data, error } = await supabase
      .from("tipos_ausencia")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true });
    if (error) throw error;
    return { ok: true, data: (data ?? []) as TipoAusenciaRow[] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[horarios-config] listTiposAusencia:", msg);
    return { ok: false, data: [] as TipoAusenciaRow[], error: msg };
  }
}

export async function createTipoAusencia(input: TipoAusenciaInput) {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const nombre = input.nombre.trim();
    if (!nombre) return { ok: false, error: "El nombre es obligatorio" };

    const orden = await nextOrden("tipos_ausencia", empresaId);

    const { data, error } = await supabase
      .from("tipos_ausencia")
      .insert({
        empresa_id: empresaId,
        nombre,
        descripcion: input.descripcion?.toString().trim() || null,
        categoria: input.categoria?.trim() || "Otros",
        color: input.color || "bg-slate-500",
        requiere_aprobacion: input.requiere_aprobacion ?? true,
        requiere_justificante: input.requiere_justificante ?? false,
        descuenta_jornada: input.descuenta_jornada ?? true,
        refleja_calendario: input.refleja_calendario ?? true,
        activo: input.activo ?? true,
        orden,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") return { ok: false, error: "Ya existe un tipo con ese nombre" };
      throw error;
    }
    return { ok: true, data: data as TipoAusenciaRow };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[horarios-config] createTipoAusencia:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateTipoAusencia(id: string, input: Partial<TipoAusenciaInput> & { orden?: number }) {
  try {
    const { supabase } = await getAppContext();
    const payload: Record<string, unknown> = {};
    if (input.nombre !== undefined) payload.nombre = input.nombre.trim();
    if (input.descripcion !== undefined) payload.descripcion = input.descripcion?.toString().trim() || null;
    if (input.categoria !== undefined) payload.categoria = input.categoria.trim();
    if (input.color !== undefined) payload.color = input.color;
    if (input.requiere_aprobacion !== undefined) payload.requiere_aprobacion = input.requiere_aprobacion;
    if (input.requiere_justificante !== undefined) payload.requiere_justificante = input.requiere_justificante;
    if (input.descuenta_jornada !== undefined) payload.descuenta_jornada = input.descuenta_jornada;
    if (input.refleja_calendario !== undefined) payload.refleja_calendario = input.refleja_calendario;
    if (input.activo !== undefined) payload.activo = input.activo;
    if (input.orden !== undefined) payload.orden = input.orden;

    const { data, error } = await supabase
      .from("tipos_ausencia")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Ya existe un tipo con ese nombre" };
      throw error;
    }
    return { ok: true, data: data as TipoAusenciaRow };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[horarios-config] updateTipoAusencia:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteTipoAusencia(id: string) {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase.from("tipos_ausencia").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[horarios-config] deleteTipoAusencia:", msg);
    return { ok: false, error: msg };
  }
}

// ─── TIPOS FICHAJE ─────────────────────────────────────────────────────
export async function listTiposFichaje() {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, data: [] as TipoFichajeRow[], error: "No autenticado" };

    const { data, error } = await supabase
      .from("tipos_fichaje")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true });
    if (error) throw error;
    return { ok: true, data: (data ?? []) as TipoFichajeRow[] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[horarios-config] listTiposFichaje:", msg);
    return { ok: false, data: [] as TipoFichajeRow[], error: msg };
  }
}

export async function createTipoFichaje(input: TipoFichajeInput) {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const nombre = input.nombre.trim();
    const codigo = input.codigo.trim().toUpperCase();
    if (!nombre) return { ok: false, error: "El nombre es obligatorio" };
    if (!codigo) return { ok: false, error: "El código es obligatorio" };

    const orden = await nextOrden("tipos_fichaje", empresaId);

    const { data, error } = await supabase
      .from("tipos_fichaje")
      .insert({
        empresa_id: empresaId,
        nombre,
        codigo,
        descripcion: input.descripcion?.toString().trim() || null,
        computa_tiempo: input.computa_tiempo ?? true,
        activo: input.activo ?? true,
        orden,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") return { ok: false, error: "Ya existe un tipo con ese código" };
      throw error;
    }
    return { ok: true, data: data as TipoFichajeRow };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[horarios-config] createTipoFichaje:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateTipoFichaje(id: string, input: Partial<TipoFichajeInput> & { orden?: number }) {
  try {
    const { supabase } = await getAppContext();
    const payload: Record<string, unknown> = {};
    if (input.nombre !== undefined) payload.nombre = input.nombre.trim();
    if (input.codigo !== undefined) payload.codigo = input.codigo.trim().toUpperCase();
    if (input.descripcion !== undefined) payload.descripcion = input.descripcion?.toString().trim() || null;
    if (input.computa_tiempo !== undefined) payload.computa_tiempo = input.computa_tiempo;
    if (input.activo !== undefined) payload.activo = input.activo;
    if (input.orden !== undefined) payload.orden = input.orden;

    const { data, error } = await supabase
      .from("tipos_fichaje")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Ya existe un tipo con ese código" };
      throw error;
    }
    return { ok: true, data: data as TipoFichajeRow };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[horarios-config] updateTipoFichaje:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteTipoFichaje(id: string) {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase.from("tipos_fichaje").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[horarios-config] deleteTipoFichaje:", msg);
    return { ok: false, error: msg };
  }
}
