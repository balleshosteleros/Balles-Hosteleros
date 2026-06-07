"use server";

import { getAppContext } from "@/lib/supabase/get-context";

async function resolveEmpresaUuid(
  supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"],
  idOrSlug: string,
): Promise<string | null> {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(idOrSlug)) return idOrSlug;
  const { data } = await supabase
    .from("empresas")
    .select("id")
    .eq("slug", idOrSlug)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

// ─── Types ─────────────────────────────────────────────────────────────
export type ConteoDias = "naturales" | "laborables";

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
  limite_dias: number | null;
  conteo_dias: ConteoDias;
  remunerada: boolean;
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
  color: string;
  requiere_solicitud: boolean;
  margen_antes_min: number;
  margen_despues_min: number;
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
  limite_dias?: number | null;
  conteo_dias?: ConteoDias;
  remunerada?: boolean;
  activo?: boolean;
};

export type TipoFichajeInput = {
  nombre: string;
  codigo: string;
  descripcion?: string | null;
  computa_tiempo?: boolean;
  color?: string;
  requiere_solicitud?: boolean;
  margen_antes_min?: number;
  margen_despues_min?: number;
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
export async function listTiposAusencia(empresaIdOrSlug?: string) {
  try {
    const { supabase, empresaId: empresaIdProfile } = await getAppContext();
    let empresaId = empresaIdProfile;
    if (empresaIdOrSlug) empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: false, data: [] as TipoAusenciaRow[], error: "Empresa no encontrada" };

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

// Crea el tipo en una o varias empresas (replicación). Si replicarEn es vacío
// o undefined usa la empresa del profile. Devuelve la fila creada en la
// PRIMERA empresa pedida (para que el hook pueda añadirla al state local).
export async function createTipoAusencia(
  input: TipoAusenciaInput,
  replicarEn?: string[],
) {
  try {
    const { supabase, empresaId: empresaIdProfile, userId } = await getAppContext();
    const targetSlugs =
      replicarEn && replicarEn.length > 0 ? replicarEn : [empresaIdProfile ?? ""];
    if (targetSlugs.length === 0 || !targetSlugs[0])
      return { ok: false, error: "No autenticado" };

    let primera: TipoAusenciaRow | null = null;
    for (const idOrSlug of targetSlugs) {
      const empresaId = await resolveEmpresaUuid(supabase, idOrSlug);
      if (!empresaId) continue;
      const row = await insertTipoAusencia(supabase, empresaId, userId, input);
      if (row && !primera) primera = row;
    }
    if (!primera) return { ok: false, error: "No se pudo crear" };
    return { ok: true, data: primera };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[horarios-config] createTipoAusencia:", msg);
    return { ok: false, error: msg };
  }
}

async function insertTipoAusencia(
  supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"],
  empresaId: string,
  userId: string | null,
  input: TipoAusenciaInput,
): Promise<TipoAusenciaRow | null> {
  try {
    const nombre = input.nombre.trim();
    if (!nombre) return null;

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
        limite_dias: input.limite_dias ?? null,
        conteo_dias: input.conteo_dias ?? "naturales",
        remunerada: input.remunerada ?? false,
        activo: input.activo ?? true,
        orden,
        created_by: userId,
      })
      .select()
      .single();
    if (error) {
      console.error("[horarios-config] insertTipoAusencia:", error.message);
      return null;
    }
    return data as TipoAusenciaRow;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[horarios-config] insertTipoAusencia:", msg);
    return null;
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
    if (input.limite_dias !== undefined) payload.limite_dias = input.limite_dias;
    if (input.conteo_dias !== undefined) payload.conteo_dias = input.conteo_dias;
    if (input.remunerada !== undefined) payload.remunerada = input.remunerada;
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
export async function listTiposFichaje(empresaIdOrSlug?: string) {
  try {
    const { supabase, empresaId: empresaIdProfile } = await getAppContext();
    let empresaId = empresaIdProfile;
    if (empresaIdOrSlug) empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: false, data: [] as TipoFichajeRow[], error: "Empresa no encontrada" };

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

export async function createTipoFichaje(
  input: TipoFichajeInput,
  replicarEn?: string[],
) {
  try {
    const { supabase, empresaId: empresaIdProfile, userId } = await getAppContext();
    const targetSlugs =
      replicarEn && replicarEn.length > 0 ? replicarEn : [empresaIdProfile ?? ""];
    if (targetSlugs.length === 0 || !targetSlugs[0])
      return { ok: false, error: "No autenticado" };

    let primera: TipoFichajeRow | null = null;
    for (const idOrSlug of targetSlugs) {
      const empresaId = await resolveEmpresaUuid(supabase, idOrSlug);
      if (!empresaId) continue;
      const row = await insertTipoFichaje(supabase, empresaId, userId, input);
      if (row && !primera) primera = row;
    }
    if (!primera) return { ok: false, error: "No se pudo crear" };
    return { ok: true, data: primera };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[horarios-config] createTipoFichaje:", msg);
    return { ok: false, error: msg };
  }
}

async function insertTipoFichaje(
  supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"],
  empresaId: string,
  userId: string | null,
  input: TipoFichajeInput,
): Promise<TipoFichajeRow | null> {
  try {
    const nombre = input.nombre.trim();
    const codigo = input.codigo.trim().toUpperCase();
    if (!nombre || !codigo) return null;

    const orden = await nextOrden("tipos_fichaje", empresaId);
    const { data, error } = await supabase
      .from("tipos_fichaje")
      .insert({
        empresa_id: empresaId,
        nombre,
        codigo,
        descripcion: input.descripcion?.toString().trim() || null,
        computa_tiempo: input.computa_tiempo ?? true,
        color: input.color ?? "slate",
        requiere_solicitud: input.requiere_solicitud ?? false,
        margen_antes_min: Math.max(0, input.margen_antes_min ?? 0),
        margen_despues_min: Math.max(0, input.margen_despues_min ?? 0),
        activo: input.activo ?? true,
        orden,
        created_by: userId,
      })
      .select()
      .single();
    if (error) {
      console.error("[horarios-config] insertTipoFichaje:", error.message);
      return null;
    }
    return data as TipoFichajeRow;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[horarios-config] insertTipoFichaje:", msg);
    return null;
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
    if (input.color !== undefined) payload.color = input.color;
    if (input.requiere_solicitud !== undefined) payload.requiere_solicitud = input.requiere_solicitud;
    if (input.margen_antes_min !== undefined) payload.margen_antes_min = Math.max(0, input.margen_antes_min);
    if (input.margen_despues_min !== undefined) payload.margen_despues_min = Math.max(0, input.margen_despues_min);
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
