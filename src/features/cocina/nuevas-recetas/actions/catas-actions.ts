"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import type { ActionResult, Cata, ValoracionCata } from "../types";
import { moverReceta } from "./recetas-actions";

async function getNombreUsuario() {
  const { supabase, userId } = await getAppContext();
  if (!userId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("nombre, apellidos")
    .eq("user_id", userId)
    .single();
  return data ? `${data.nombre ?? ""} ${data.apellidos ?? ""}`.trim() || null : null;
}

// ──────────────────────────────────────────────────────────────
// Listar catas de una receta
// ──────────────────────────────────────────────────────────────
export async function listCatas(recetaId: string): Promise<ActionResult<Cata[]>> {
  try {
    const { supabase } = await getAppContext();
    const { data, error } = await supabase
      .from("nueva_receta_cata")
      .select("*")
      .eq("receta_id", recetaId)
      .order("numero", { ascending: true });
    if (error) throw error;
    return { ok: true, data: (data as Cata[]) ?? [] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

// ──────────────────────────────────────────────────────────────
// Crear o actualizar cata
// ──────────────────────────────────────────────────────────────
export async function upsertCata(input: {
  id?: string;
  receta_id: string;
  numero: number;
  fecha?: string;
  valoracion?: ValoracionCata;
  aciertos?: string;
  mejoras?: string;
  coste_real?: number;
  pvp_sugerido?: number;
  foto_url?: string;
}): Promise<ActionResult<Cata>> {
  try {
    const { supabase, userId } = await getAppContext();
    const director_nombre = await getNombreUsuario();

    // Snapshot del escandallo actual
    const { data: receta } = await supabase
      .from("nuevas_recetas")
      .select("esc_coste_estimado, esc_pvp_propuesto, esc_porciones, esc_etiquetas_finales")
      .eq("id", input.receta_id)
      .single();

    const escandallo_snapshot = receta ?? null;

    if (input.id) {
      const { data, error } = await supabase
        .from("nueva_receta_cata")
        .update({
          fecha: input.fecha,
          valoracion: input.valoracion ?? null,
          aciertos: input.aciertos ?? null,
          mejoras: input.mejoras ?? null,
          coste_real: input.coste_real ?? null,
          pvp_sugerido: input.pvp_sugerido ?? null,
          foto_url: input.foto_url ?? null,
        })
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return { ok: true, data: data as Cata };
    }

    const { data, error } = await supabase
      .from("nueva_receta_cata")
      .insert({
        receta_id: input.receta_id,
        numero: input.numero,
        fecha: input.fecha ?? new Date().toISOString().slice(0, 10),
        valoracion: input.valoracion ?? "pendiente",
        aciertos: input.aciertos ?? null,
        mejoras: input.mejoras ?? null,
        coste_real: input.coste_real ?? null,
        pvp_sugerido: input.pvp_sugerido ?? null,
        foto_url: input.foto_url ?? null,
        escandallo_snapshot,
        director_user_id: userId,
        director_nombre,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data: data as Cata };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[catas][upsert]", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Procesa la valoración de una cata y mueve la receta automáticamente:
 *   - rehacer_entera → vuelve a la Fase 1 (Propuesta)
 *   - rehacer_media  → se queda en la fase actual
 *   - semi_aprobada / aprobada → puede avanzar (se muestra botón en UI)
 */
export async function procesarValoracion(input: {
  cataId: string;
  recetaId: string;
  valoracion: ValoracionCata;
}): Promise<ActionResult> {
  try {
    const { supabase } = await getAppContext();

    await supabase
      .from("nueva_receta_cata")
      .update({ valoracion: input.valoracion })
      .eq("id", input.cataId);

    if (input.valoracion === "rehacer_entera") {
      // Buscar fase 1 (Propuesta) de la empresa
      const { data: receta } = await supabase
        .from("nuevas_recetas")
        .select("empresa_id")
        .eq("id", input.recetaId)
        .single();
      if (receta) {
        const { data: fase1 } = await supabase
          .from("nueva_receta_fase")
          .select("id")
          .eq("empresa_id", receta.empresa_id)
          .eq("orden", 1)
          .single();
        if (fase1) {
          await moverReceta({
            recetaId: input.recetaId,
            faseDestinoId: fase1.id as string,
            nota: "Rehacer entera tras cata",
            comunicar: false,
          });
        }
      }
    }
    // rehacer_media: se queda en fase actual (nada que hacer aquí)
    // semi_aprobada / aprobada: el usuario decide avanzar manualmente

    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function deleteCata(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase
      .from("nueva_receta_cata")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}
