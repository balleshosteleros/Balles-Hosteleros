"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import type {
  ActionResult, Fase, SubEstado, Gatekeeper, FaseColor, GatekeeperTipo,
} from "../types";
import { ensureFasesDefault } from "../services/seed-fases";

export interface FaseConPolicies extends Fase {
  sub_estados: SubEstado[];
  gatekeepers: Gatekeeper[];
}

// ──────────────────────────────────────────────────────────────
// Lectura
// ──────────────────────────────────────────────────────────────
export async function listFases(): Promise<ActionResult<FaseConPolicies[]>> {
  try {
    // Asegura seed antes de leer
    await ensureFasesDefault();

    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa" };

    const { data: fases, error: fErr } = await supabase
      .from("nueva_receta_fase")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true });
    if (fErr) throw fErr;

    const faseIds = (fases ?? []).map((f) => f.id);
    if (faseIds.length === 0) return { ok: true, data: [] };

    const [subRes, gkRes] = await Promise.all([
      supabase
        .from("nueva_receta_sub_estado")
        .select("*")
        .in("fase_id", faseIds)
        .order("orden", { ascending: true }),
      supabase
        .from("nueva_receta_gatekeeper")
        .select("*")
        .in("fase_id", faseIds)
        .order("orden", { ascending: true }),
    ]);
    if (subRes.error) throw subRes.error;
    if (gkRes.error) throw gkRes.error;

    const subs = (subRes.data ?? []) as SubEstado[];
    const gks = (gkRes.data ?? []) as Gatekeeper[];

    const result: FaseConPolicies[] = (fases ?? []).map((f) => ({
      ...(f as Fase),
      sub_estados: subs.filter((s) => s.fase_id === f.id),
      gatekeepers: gks.filter((g) => g.fase_id === f.id),
    }));

    return { ok: true, data: result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[fases][list]", msg);
    return { ok: false, error: msg };
  }
}

// ──────────────────────────────────────────────────────────────
// Crear fase
// ──────────────────────────────────────────────────────────────
export async function createFase(input: {
  nombre: string;
  color: FaseColor;
  plazo_dias?: number | null;
  responsable_departamento?: string | null;
  responsable_user_id?: string | null;
}): Promise<ActionResult<Fase>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa" };

    // Contar existentes para respetar límite 10
    const { count } = await supabase
      .from("nueva_receta_fase")
      .select("*", { count: "exact", head: true })
      .eq("empresa_id", empresaId);
    if ((count ?? 0) >= 10) {
      return { ok: false, error: "Límite alcanzado: máximo 10 fases por empresa" };
    }

    const orden = (count ?? 0) + 1;

    const { data, error } = await supabase
      .from("nueva_receta_fase")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre.trim(),
        color: input.color,
        orden,
        plazo_dias: input.plazo_dias ?? null,
        responsable_departamento: input.responsable_departamento ?? null,
        responsable_user_id: input.responsable_user_id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data: data as Fase };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[fases][create]", msg);
    return { ok: false, error: msg };
  }
}

// ──────────────────────────────────────────────────────────────
// Actualizar fase
// ──────────────────────────────────────────────────────────────
export async function updateFase(
  id: string,
  patch: Partial<Pick<Fase, "nombre" | "color" | "plazo_dias" | "responsable_departamento" | "responsable_user_id" | "orden">>,
): Promise<ActionResult<Fase>> {
  try {
    const { supabase } = await getAppContext();
    const { data, error } = await supabase
      .from("nueva_receta_fase")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data: data as Fase };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[fases][update]", msg);
    return { ok: false, error: msg };
  }
}

// ──────────────────────────────────────────────────────────────
// Borrar fase (bloquea si tiene recetas)
// ──────────────────────────────────────────────────────────────
export async function deleteFase(
  id: string,
): Promise<ActionResult<{ recetasEnFase: number }>> {
  try {
    const { supabase } = await getAppContext();

    const { count } = await supabase
      .from("nuevas_recetas")
      .select("*", { count: "exact", head: true })
      .eq("fase_id", id);

    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: `No se puede borrar: hay ${count} receta(s) en esta fase. Muévelas antes.`,
      };
    }

    // Verificar que no es fase sistema
    const { data: fase } = await supabase
      .from("nueva_receta_fase")
      .select("es_sistema")
      .eq("id", id)
      .single();
    if (fase?.es_sistema) {
      return { ok: false, error: "Esta fase es del sistema y no se puede borrar" };
    }

    const { error } = await supabase
      .from("nueva_receta_fase")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true, data: { recetasEnFase: 0 } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[fases][delete]", msg);
    return { ok: false, error: msg };
  }
}

// ──────────────────────────────────────────────────────────────
// Reordenar fases (drag-and-drop)
// ──────────────────────────────────────────────────────────────
export async function reordenarFases(
  orderedIds: string[],
): Promise<ActionResult> {
  try {
    const { supabase } = await getAppContext();
    await Promise.all(
      orderedIds.map((id, idx) =>
        supabase.from("nueva_receta_fase").update({ orden: idx + 1 }).eq("id", id),
      ),
    );
    return { ok: true, data: undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return { ok: false, error: msg };
  }
}

// ──────────────────────────────────────────────────────────────
// Sub-estados
// ──────────────────────────────────────────────────────────────
export async function createSubEstado(
  faseId: string,
  nombre: string,
): Promise<ActionResult<SubEstado>> {
  try {
    const { supabase } = await getAppContext();
    const { count } = await supabase
      .from("nueva_receta_sub_estado")
      .select("*", { count: "exact", head: true })
      .eq("fase_id", faseId);
    if ((count ?? 0) >= 6) {
      return { ok: false, error: "Límite alcanzado: máximo 6 sub-estados por fase" };
    }
    const { data, error } = await supabase
      .from("nueva_receta_sub_estado")
      .insert({ fase_id: faseId, nombre: nombre.trim(), orden: (count ?? 0) + 1 })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data: data as SubEstado };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function updateSubEstado(
  id: string,
  patch: Partial<Pick<SubEstado, "nombre" | "orden">>,
): Promise<ActionResult> {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase
      .from("nueva_receta_sub_estado")
      .update(patch)
      .eq("id", id);
    if (error) throw error;
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function deleteSubEstado(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase
      .from("nueva_receta_sub_estado")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

// ──────────────────────────────────────────────────────────────
// Gatekeepers
// ──────────────────────────────────────────────────────────────
export async function upsertGatekeeper(input: {
  id?: string;
  fase_id: string;
  campo: string;
  label: string;
  tipo: GatekeeperTipo;
  obligatorio: boolean;
  orden?: number;
}): Promise<ActionResult<Gatekeeper>> {
  try {
    const { supabase } = await getAppContext();
    const { data, error } = input.id
      ? await supabase
          .from("nueva_receta_gatekeeper")
          .update({
            campo: input.campo,
            label: input.label,
            tipo: input.tipo,
            obligatorio: input.obligatorio,
            orden: input.orden ?? 0,
          })
          .eq("id", input.id)
          .select()
          .single()
      : await supabase
          .from("nueva_receta_gatekeeper")
          .insert({
            fase_id: input.fase_id,
            campo: input.campo,
            label: input.label,
            tipo: input.tipo,
            obligatorio: input.obligatorio,
            orden: input.orden ?? 0,
          })
          .select()
          .single();
    if (error) throw error;
    return { ok: true, data: data as Gatekeeper };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function deleteGatekeeper(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase
      .from("nueva_receta_gatekeeper")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}
