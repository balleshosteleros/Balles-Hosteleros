"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import {
  findPlaceByText,
  getPlaceDetails,
  getGoogleMapsApiKey,
  estadoDesdeRating,
} from "@/lib/google/places";
import type {
  EstadoResena,
  OrigenResena,
  Resena,
} from "@/features/calidad/types/resenas";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

// ─── Empresa: Place ID ──────────────────────────────────────────

export interface EmpresaPlaceInfo {
  empresaId: string;
  nombre: string;
  direccion: string | null;
  googlePlaceId: string | null;
  googleApiKeyConfigured: boolean;
}

export async function getEmpresaPlaceInfo(): Promise<EmpresaPlaceInfo | null> {
  const { supabase, empresaId } = await getContext();
  if (!empresaId) return null;
  const { data, error } = await supabase
    .from("empresas")
    .select("id, nombre, direccion, datos_generales, google_place_id")
    .eq("id", empresaId)
    .maybeSingle();
  if (error || !data) return null;
  const dg = (data.datos_generales as Record<string, unknown> | null) ?? null;
  const direccionFromJson =
    (dg?.direccionLocal as string | undefined) ||
    (dg?.direccionFiscal as string | undefined) ||
    null;
  return {
    empresaId: data.id as string,
    nombre: (data.nombre as string) ?? "",
    direccion:
      (data.direccion as string | null) ?? direccionFromJson ?? null,
    googlePlaceId: (data.google_place_id as string | null) ?? null,
    googleApiKeyConfigured: getGoogleMapsApiKey() !== null,
  };
}

export async function setEmpresaPlaceId(placeId: string | null) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    const clean = placeId?.trim() || null;
    const { error } = await supabase
      .from("empresas")
      .update({ google_place_id: clean })
      .eq("id", empresaId);
    if (error) throw error;
    revalidatePath("/calidad/resenas");
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false as const, error: msg };
  }
}

/**
 * Resuelve el place_id de la empresa actual desde Google a partir de
 * `{nombre} {direccion}`. NO lo guarda automáticamente — devuelve el
 * candidato para que la UI muestre un banner de confirmación.
 */
export async function detectarPlaceIdEmpresa(): Promise<
  | { ok: true; candidate: { placeId: string; name: string; address: string } }
  | { ok: false; error: string }
> {
  try {
    if (!getGoogleMapsApiKey()) {
      return { ok: false, error: "MISSING_GOOGLE_MAPS_API_KEY" };
    }
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { data } = await supabase
      .from("empresas")
      .select("nombre, datos_generales")
      .eq("id", empresaId)
      .maybeSingle();
    if (!data) return { ok: false, error: "Empresa no encontrada" };
    const dg = (data.datos_generales as Record<string, unknown> | null) ?? {};
    const nombreComercial =
      (dg.nombreComercial as string | undefined)?.trim() ||
      ((data.nombre as string | null) ?? "").trim();
    const direccion =
      (dg.direccionLocal as string | undefined)?.trim() ||
      (dg.direccionFiscal as string | undefined)?.trim() ||
      "";
    const ciudad = (dg.ciudad as string | undefined)?.trim() ?? "";
    const cp = (dg.codigoPostal as string | undefined)?.trim() ?? "";
    if (!nombreComercial) {
      return { ok: false, error: "Empresa sin nombre" };
    }
    // "Restaurante" sesga contra ciudades/países homónimos (ej. "Habana" → Cuba).
    const query = ["Restaurante", nombreComercial, direccion, cp, ciudad]
      .filter(Boolean)
      .join(" ");
    const cand = await findPlaceByText(query);
    if (!cand) return { ok: false, error: "Google no encontró ningún local" };
    return {
      ok: true,
      candidate: {
        placeId: cand.placeId,
        name: cand.name,
        address: cand.formattedAddress,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

/**
 * Busca un local con texto libre escrito por el usuario. Se usa cuando la
 * auto-detección falla porque la empresa no tiene dirección guardada o el
 * nombre es ambiguo ("Habana" → ciudad de Cuba).
 */
export async function buscarPlaceCustom(query: string): Promise<
  | { ok: true; candidate: { placeId: string; name: string; address: string } }
  | { ok: false; error: string }
> {
  try {
    if (!getGoogleMapsApiKey()) {
      return { ok: false, error: "MISSING_GOOGLE_MAPS_API_KEY" };
    }
    const q = query.trim();
    if (!q) return { ok: false, error: "Escribe algo en el buscador" };
    const cand = await findPlaceByText(q);
    if (!cand) return { ok: false, error: "Google no encontró ningún local" };
    return {
      ok: true,
      candidate: {
        placeId: cand.placeId,
        name: cand.name,
        address: cand.formattedAddress,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

// ─── Pipeline: read ─────────────────────────────────────────────

export async function listResenas(): Promise<Resena[]> {
  const { supabase, empresaId } = await getContext();
  if (!empresaId) return [];
  const { data, error } = await supabase
    .from("resenas")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("posicion", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[resenas] list:", error.message);
    return [];
  }
  return (data ?? []) as Resena[];
}

// ─── Pipeline: write ────────────────────────────────────────────

export interface CrearResenaInput {
  nombre_comensal: string;
  telefono?: string | null;
  email?: string | null;
  comentario?: string | null;
  estado?: EstadoResena;
  rating?: number | null;
  origen?: OrigenResena;
}

export async function crearResena(input: CrearResenaInput) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    const { data, error } = await supabase
      .from("resenas")
      .insert({
        empresa_id: empresaId,
        nombre_comensal: input.nombre_comensal,
        telefono: input.telefono ?? null,
        email: input.email ?? null,
        comentario: input.comentario ?? null,
        estado: input.estado ?? "nuevo_comensal",
        rating: input.rating ?? null,
        origen: input.origen ?? "manual",
        creado_por: user?.id ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/calidad/resenas");
    return { ok: true as const, data: data as Resena };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false as const, error: msg };
  }
}

export interface ActualizarResenaInput {
  nombre_comensal?: string;
  telefono?: string | null;
  email?: string | null;
  comentario?: string | null;
  estado?: EstadoResena;
  rating?: number | null;
  respuesta_propietario?: string | null;
  respondida?: boolean;
}

export async function actualizarResena(
  id: string,
  input: ActualizarResenaInput,
) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("resenas")
      .update(input)
      .eq("id", id);
    if (error) throw error;
    revalidatePath("/calidad/resenas");
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false as const, error: msg };
  }
}

export async function moverResena(id: string, estado: EstadoResena) {
  return actualizarResena(id, { estado });
}

export async function eliminarResena(id: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.from("resenas").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/calidad/resenas");
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false as const, error: msg };
  }
}

// ─── Pipeline: Google sync ──────────────────────────────────────

export interface SyncGoogleResult {
  ok: boolean;
  error?: string;
  insertadas: number;
  actualizadas: number;
  total: number;
}

/**
 * Trae las reseñas de Google (Places API) para la empresa activa y las
 * upsertea en la tabla `resenas`. Idempotente: usa `external_id` como
 * clave de dedup. NO sobrescribe campos editados manualmente por el
 * usuario (estado, comentario, respuesta) si la reseña ya existe.
 */
export async function syncResenasGoogle(): Promise<SyncGoogleResult> {
  try {
    if (!getGoogleMapsApiKey()) {
      return {
        ok: false,
        error: "MISSING_GOOGLE_MAPS_API_KEY",
        insertadas: 0,
        actualizadas: 0,
        total: 0,
      };
    }
    const { supabase, empresaId } = await getContext();
    if (!empresaId)
      return {
        ok: false,
        error: "No autenticado",
        insertadas: 0,
        actualizadas: 0,
        total: 0,
      };

    const { data: emp } = await supabase
      .from("empresas")
      .select("google_place_id")
      .eq("id", empresaId)
      .maybeSingle();
    const placeId = emp?.google_place_id as string | null | undefined;
    if (!placeId) {
      return {
        ok: false,
        error: "EMPRESA_SIN_PLACE_ID",
        insertadas: 0,
        actualizadas: 0,
        total: 0,
      };
    }

    const details = await getPlaceDetails(placeId);
    if (!details) {
      return {
        ok: false,
        error: "PLACE_NO_ENCONTRADO",
        insertadas: 0,
        actualizadas: 0,
        total: 0,
      };
    }

    if (details.reviews.length === 0) {
      return { ok: true, insertadas: 0, actualizadas: 0, total: 0 };
    }

    const externalIds = details.reviews.map((r) => r.externalId);
    const { data: existentes } = await supabase
      .from("resenas")
      .select("id, external_id")
      .eq("empresa_id", empresaId)
      .in("external_id", externalIds);

    const existentesMap = new Map<string, string>();
    for (const row of existentes ?? []) {
      const eid = (row as { external_id: string | null }).external_id;
      if (eid) existentesMap.set(eid, (row as { id: string }).id);
    }

    let insertadas = 0;
    let actualizadas = 0;
    const nowIso = new Date().toISOString();

    for (const rev of details.reviews) {
      const existingId = existentesMap.get(rev.externalId);
      if (existingId) {
        const { error: errUpd } = await supabase
          .from("resenas")
          .update({
            autor_avatar: rev.authorAvatar,
            autor_url: rev.authorUrl,
            comentario: rev.text || null,
            rating: rev.rating,
            fecha_reseña: rev.time,
            synced_at: nowIso,
          })
          .eq("id", existingId);
        if (!errUpd) actualizadas++;
      } else {
        const { error: errIns } = await supabase.from("resenas").insert({
          empresa_id: empresaId,
          nombre_comensal: rev.authorName,
          comentario: rev.text || null,
          rating: rev.rating,
          estado: estadoDesdeRating(rev.rating),
          origen: "google",
          external_id: rev.externalId,
          autor_url: rev.authorUrl,
          autor_avatar: rev.authorAvatar,
          fecha_reseña: rev.time,
          synced_at: nowIso,
        });
        if (!errIns) insertadas++;
      }
    }

    // Auto-generación de borradores para las nuevas reseñas (best-effort,
    // si falla no rompe el sync).
    if (insertadas > 0) {
      try {
        const { generarBorradoresPendientes } = await import(
          "./agentes-ia-actions"
        );
        await generarBorradoresPendientes();
      } catch (e) {
        console.warn("[resenas] generar borradores tras sync falló:", e);
      }
    }

    revalidatePath("/calidad/resenas");
    return {
      ok: true,
      insertadas,
      actualizadas,
      total: details.reviews.length,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return {
      ok: false,
      error: msg,
      insertadas: 0,
      actualizadas: 0,
      total: 0,
    };
  }
}
