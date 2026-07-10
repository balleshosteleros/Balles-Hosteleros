"use server";

import { getCamarasContext } from "@/features/camaras/lib/supabase-context";

export type CamaraRow = {
  id: string;
  empresa_id: string;
  local_id: string | null;
  nombre: string;
  ubicacion: string | null;
  canal: number | null;
  stream_subtipo: number;
  orden: number;
  activo: boolean;
  // PRP-061: vínculo al conector + datos de stream (sin credenciales)
  conector_id: string | null;
  onvif_uid: string | null;
  rtsp_path: string | null;
  soporta_rebobinado: boolean;
  grabacion_cloud: boolean;
  created_at: string;
  updated_at: string;
};

export async function listCamaras() {
  try {
    const { supabase, empresaId } = await getCamarasContext();
    if (!empresaId) return { ok: false as const, data: [] as CamaraRow[], error: "Sin empresa activa" };
    const { data, error } = await supabase
      .from("camaras")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });
    if (error) throw error;
    return { ok: true as const, data: (data ?? []) as CamaraRow[] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[camaras] list:", msg);
    return { ok: false as const, data: [] as CamaraRow[], error: msg };
  }
}

export async function createCamara(input: {
  nombre: string;
  ubicacion?: string | null;
  localId?: string | null;
  canal?: number | null;
}) {
  try {
    const { supabase, empresaId, userId } = await getCamarasContext();
    if (!userId || !empresaId) return { ok: false as const, error: "No autenticado" };
    const nombre = input.nombre.trim();
    if (!nombre) return { ok: false as const, error: "El nombre es obligatorio" };

    const { data: maxRow } = await supabase
      .from("camaras")
      .select("orden")
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrden = (maxRow?.orden ?? 0) + 1;

    const { data, error } = await supabase
      .from("camaras")
      .insert({
        empresa_id: empresaId,
        local_id: input.localId ?? null,
        nombre,
        ubicacion: input.ubicacion?.trim() || null,
        canal: input.canal ?? null,
        orden: nextOrden,
        activo: true,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true as const, data: data as CamaraRow };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[camaras] create:", msg);
    return { ok: false as const, error: msg };
  }
}

export async function updateCamara(
  id: string,
  patch: Partial<{
    nombre: string;
    ubicacion: string | null;
    localId: string | null;
    canal: number | null;
    activo: boolean;
    orden: number;
  }>,
) {
  try {
    const { supabase, empresaId } = await getCamarasContext();
    if (!empresaId) return { ok: false as const, error: "Sin empresa activa" };

    const updates: Record<string, unknown> = {};
    if (patch.nombre !== undefined) updates.nombre = patch.nombre.trim();
    if (patch.ubicacion !== undefined) updates.ubicacion = patch.ubicacion?.trim() || null;
    if (patch.localId !== undefined) updates.local_id = patch.localId;
    if (patch.canal !== undefined) updates.canal = patch.canal;
    if (patch.activo !== undefined) updates.activo = patch.activo;
    if (patch.orden !== undefined) updates.orden = patch.orden;

    const { data, error } = await supabase
      .from("camaras")
      .update(updates)
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true as const, data: data as CamaraRow };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[camaras] update:", msg);
    return { ok: false as const, error: msg };
  }
}

export type CamaraGrabacionRow = {
  id: string;
  camara_id: string;
  url: string | null;
  r2_key: string;
  inicio: string;
  fin: string;
  duracion_seg: number;
  file_size: number;
};

/**
 * Lista los clips de una cámara para rebobinar. Lee de `camara_grabaciones`
 * (que vive en R2); NO se conecta al grabador. Rango opcional [desde, hasta].
 */
export async function listGrabaciones(input: {
  camaraId: string;
  desde?: string | null;
  hasta?: string | null;
  limit?: number;
}) {
  try {
    const { supabase, empresaId } = await getCamarasContext();
    if (!empresaId) return { ok: false as const, data: [] as CamaraGrabacionRow[], error: "Sin empresa activa" };

    let query = supabase
      .from("camara_grabaciones")
      .select("id, camara_id, url, r2_key, inicio, fin, duracion_seg, file_size")
      .eq("empresa_id", empresaId)
      .eq("camara_id", input.camaraId)
      .order("inicio", { ascending: false })
      .limit(Math.min(input.limit ?? 200, 500));

    if (input.desde) query = query.gte("inicio", input.desde);
    if (input.hasta) query = query.lte("inicio", input.hasta);

    const { data, error } = await query;
    if (error) throw error;
    return { ok: true as const, data: (data ?? []) as CamaraGrabacionRow[] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[camaras] listGrabaciones:", msg);
    return { ok: false as const, data: [] as CamaraGrabacionRow[], error: msg };
  }
}

/**
 * Cobertura de grabación de una cámara: primer y último clip disponibles, para
 * mostrar al usuario "tienes vídeo desde X hasta Y" sin preguntar al grabador.
 */
export async function getCoberturaGrabacion(camaraId: string) {
  try {
    const { supabase, empresaId } = await getCamarasContext();
    if (!empresaId) return { ok: false as const, error: "Sin empresa activa" };

    const base = supabase
      .from("camara_grabaciones")
      .select("inicio")
      .eq("empresa_id", empresaId)
      .eq("camara_id", camaraId);

    const [{ data: primero }, { data: ultimo }] = await Promise.all([
      base.order("inicio", { ascending: true }).limit(1).maybeSingle(),
      supabase
        .from("camara_grabaciones")
        .select("inicio")
        .eq("empresa_id", empresaId)
        .eq("camara_id", camaraId)
        .order("inicio", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then((r) => ({ data: r.data })),
    ]);

    return {
      ok: true as const,
      desde: primero?.inicio ?? null,
      hasta: ultimo?.inicio ?? null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[camaras] getCoberturaGrabacion:", msg);
    return { ok: false as const, error: msg };
  }
}

export async function deleteCamara(id: string) {
  try {
    const { supabase, empresaId } = await getCamarasContext();
    if (!empresaId) return { ok: false as const, error: "Sin empresa activa" };
    const { error } = await supabase
      .from("camaras")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[camaras] delete:", msg);
    return { ok: false as const, error: msg };
  }
}
