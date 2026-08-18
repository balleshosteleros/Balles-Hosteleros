"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import {
  findPlaceByText,
  getPlaceDetails,
  getGoogleMapsApiKey,
} from "@/lib/google/places";
import { syncResenasGoogleForEmpresa } from "@/features/calidad/services/resenas-google-sync";
import type { SyncGoogleResult } from "@/features/calidad/services/resenas-google-sync";
import type {
  CogeTelefono,
  EstadoGestionResena,
  EstadoResena,
  OrigenResena,
  PlataformaResena,
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
 * Devuelve QUÉ local está vinculado ahora mismo (nombre + dirección), leyéndolo
 * de Google a partir del `google_place_id` guardado.
 *
 * Sin esto la pantalla solo podía decir "Local vinculado" sin decir cuál, y no
 * había forma de comprobar que apunta al restaurante correcto: si por lo que
 * fuera estuviera apuntando a otro sitio, se estarían leyendo y contestando
 * las reseñas de otro negocio sin que nadie se diera cuenta.
 */
export async function getLocalVinculado(): Promise<
  | { ok: true; local: { name: string; address: string } }
  | { ok: false; error: string }
> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { data } = await supabase
      .from("empresas")
      .select("google_place_id")
      .eq("id", empresaId)
      .maybeSingle();
    const placeId = (data?.google_place_id as string | null)?.trim();
    if (!placeId) return { ok: false, error: "SIN_PLACE_ID" };
    if (!getGoogleMapsApiKey()) {
      return { ok: false, error: "MISSING_GOOGLE_MAPS_API_KEY" };
    }
    const details = await getPlaceDetails(placeId);
    if (!details) return { ok: false, error: "PLACE_NO_ENCONTRADO" };
    return {
      ok: true,
      local: { name: details.name, address: details.formattedAddress },
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
  // Seguimiento de calidad
  plataforma?: PlataformaResena | null;
  fecha_registro?: string | null;
  fecha_sesion?: string | null;
  coge_telefono?: CogeTelefono | null;
  estado_gestion?: EstadoGestionResena | null;
  observaciones_closer?: string | null;
  gestionada_por?: string | null;
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

// ─── Empleados para "Gestionada por" ────────────────────────────

export interface EmpleadoGestor {
  userId: string;
  nombre: string;
  puesto: string | null;
  departamento: string | null;
}

/**
 * Empleados activos de la empresa, para el desplegable "Gestionada por".
 * Vía RPC SECURITY DEFINER: `usuarios` tiene RLS que solo deja ver el propio
 * perfil, así que sin la RPC el desplegable saldría con una sola persona.
 */
export async function listEmpleadosGestores(): Promise<EmpleadoGestor[]> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return [];
    const { data, error } = await supabase.rpc("chat_empleados", {
      p_empresa: empresaId,
    });
    if (error) throw error;
    return (data ?? [])
      .filter((r: Record<string, unknown>) => !!r.user_id)
      .map((r: Record<string, unknown>) => ({
        userId: r.user_id as string,
        nombre: [r.nombre as string, r.apellidos as string]
          .filter(Boolean)
          .join(" ")
          .trim(),
        puesto: (r.puesto as string | null) ?? null,
        departamento: (r.departamento as string | null) ?? null,
      }))
      .sort((a: EmpleadoGestor, b: EmpleadoGestor) =>
        a.nombre.localeCompare(b.nombre, "es"),
      );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[resenas] listEmpleadosGestores:", msg);
    return [];
  }
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

/**
 * Trae las reseñas de Google (Places API) para la empresa activa y las
 * upsertea en la tabla `resenas`. Idempotente: usa `external_id` como
 * clave de dedup. NO sobrescribe campos editados manualmente por el
 * usuario (estado, comentario, respuesta) si la reseña ya existe.
 */
export async function syncResenasGoogle(): Promise<SyncGoogleResult> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId)
      return {
        ok: false,
        error: "No autenticado",
        insertadas: 0,
        actualizadas: 0,
        total: 0,
      };

    const result = await syncResenasGoogleForEmpresa(supabase, empresaId);

    if (result.ok && result.insertadas > 0) {
      try {
        const { generarBorradoresPendientes } = await import(
          "./agentes-ia-actions"
        );
        await generarBorradoresPendientes();
      } catch (e) {
        console.warn("[resenas] generar borradores tras sync falló:", e);
      }
    }

    if (result.ok) revalidatePath("/calidad/resenas");
    // Google solo devuelve 5 reseñas por consulta: si las 5 son nuevas, el
    // cupo se llenó y pudo quedarse alguna fuera. Aquí no se emite aviso
    // interno (el usuario está mirando la pantalla); se marca para que la UI
    // lo diga en el mismo momento.
    return { ...result, cupoLleno: result.ok && result.insertadas >= 5 };
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
