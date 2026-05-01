"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import type {
  ActionResult, CambioCarta, CambioCartaConSemanas, CambioCartaSemana, FaseColor,
} from "../types";
import { ensureFasesDefault } from "../services/seed-fases";

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtNombre(fechaOficial: string): string {
  const d = new Date(fechaOficial + "T00:00:00");
  const dd = String(d.getDate()).padStart(2, "0");
  const mes = d.toLocaleDateString("es-ES", { month: "long" });
  return `Cambio de carta — ${dd} ${mes} ${d.getFullYear()}`;
}

// ──────────────────────────────────────────────────────────────
// Listar cambios de carta del año (con sus semanas)
// ──────────────────────────────────────────────────────────────
export async function listCambiosCarta(
  anio?: number,
): Promise<ActionResult<CambioCartaConSemanas[]>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa" };

    let query = supabase
      .from("cambios_carta")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("fecha_oficial", { ascending: true });

    if (anio) {
      query = query
        .gte("fecha_oficial", `${anio}-01-01`)
        .lte("fecha_oficial", `${anio}-12-31`);
    }

    const { data: cambios, error } = await query;
    if (error) throw error;

    const ids = (cambios ?? []).map((c) => c.id);
    if (ids.length === 0) return { ok: true, data: [] };

    const { data: semanas, error: sErr } = await supabase
      .from("cambios_carta_semana")
      .select("*")
      .in("cambio_carta_id", ids)
      .order("orden", { ascending: true });
    if (sErr) throw sErr;

    const result: CambioCartaConSemanas[] = (cambios ?? []).map((c) => ({
      ...(c as CambioCarta),
      semanas: ((semanas ?? []) as CambioCartaSemana[]).filter(
        (s) => s.cambio_carta_id === c.id,
      ),
    }));

    return { ok: true, data: result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[cambios-carta][list]", msg);
    return { ok: false, error: msg };
  }
}

// ──────────────────────────────────────────────────────────────
// Crear cambio de carta a partir de fecha de inicio
// → 5 semanas consecutivas (una por fase pipeline) por defecto
// → fecha_oficial = inicio de la última fase (Marketing y carta)
// ──────────────────────────────────────────────────────────────
export async function crearCambioCarta(input: {
  fecha_inicio: string;
  notas?: string;
}): Promise<ActionResult<CambioCartaConSemanas>> {
  try {
    await ensureFasesDefault();

    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa" };

    const { data: fases, error: fErr } = await supabase
      .from("nueva_receta_fase")
      .select("id, nombre, color, orden")
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true });
    if (fErr) throw fErr;
    if (!fases || fases.length === 0) {
      return { ok: false, error: "No hay fases configuradas" };
    }

    const totalSemanas = fases.length;
    const fechaOficial = addDays(input.fecha_inicio, (totalSemanas - 1) * 7);

    const { data: cambio, error: cErr } = await supabase
      .from("cambios_carta")
      .insert({
        empresa_id: empresaId,
        nombre: fmtNombre(fechaOficial),
        fecha_inicio: input.fecha_inicio,
        fecha_oficial: fechaOficial,
        notas: input.notas ?? null,
        created_by: userId,
      })
      .select()
      .single();
    if (cErr) throw cErr;

    const semanasInsert = fases.map((f, idx) => {
      const inicio = addDays(input.fecha_inicio, idx * 7);
      const fin = addDays(inicio, 6);
      return {
        cambio_carta_id: cambio.id,
        fase_id: f.id,
        fase_nombre: f.nombre,
        color: f.color,
        orden: idx + 1,
        fecha_inicio: inicio,
        fecha_fin: fin,
        es_oficial: idx === fases.length - 1,
      };
    });

    const { data: semanasData, error: sErr } = await supabase
      .from("cambios_carta_semana")
      .insert(semanasInsert)
      .select();
    if (sErr) throw sErr;

    return {
      ok: true,
      data: {
        ...(cambio as CambioCarta),
        semanas: (semanasData ?? []) as CambioCartaSemana[],
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[cambios-carta][create]", msg);
    return { ok: false, error: msg };
  }
}

// ──────────────────────────────────────────────────────────────
// Mover una semana (fecha_inicio nueva). Recalcula fecha_fin = +6
// No toca el resto de semanas (movimiento independiente).
// ──────────────────────────────────────────────────────────────
export async function moverSemana(input: {
  semana_id: string;
  fecha_inicio: string;
}): Promise<ActionResult<CambioCartaSemana>> {
  try {
    const { supabase } = await getAppContext();
    const fin = addDays(input.fecha_inicio, 6);
    const { data, error } = await supabase
      .from("cambios_carta_semana")
      .update({
        fecha_inicio: input.fecha_inicio,
        fecha_fin: fin,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.semana_id)
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data: data as CambioCartaSemana };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[cambios-carta][mover-semana]", msg);
    return { ok: false, error: msg };
  }
}

// ──────────────────────────────────────────────────────────────
// Mover bloque completo (todas las semanas se desplazan N días)
// ──────────────────────────────────────────────────────────────
export async function moverCambioCarta(input: {
  cambio_carta_id: string;
  fecha_inicio: string;
}): Promise<ActionResult> {
  try {
    const { supabase } = await getAppContext();

    const { data: semanas, error } = await supabase
      .from("cambios_carta_semana")
      .select("id, orden")
      .eq("cambio_carta_id", input.cambio_carta_id)
      .order("orden", { ascending: true });
    if (error) throw error;
    if (!semanas || semanas.length === 0) {
      return { ok: false, error: "Sin semanas" };
    }

    await Promise.all(
      semanas.map((s) => {
        const ini = addDays(input.fecha_inicio, (s.orden - 1) * 7);
        const fin = addDays(ini, 6);
        return supabase
          .from("cambios_carta_semana")
          .update({ fecha_inicio: ini, fecha_fin: fin, updated_at: new Date().toISOString() })
          .eq("id", s.id);
      }),
    );

    await supabase
      .from("cambios_carta")
      .update({ fecha_inicio: input.fecha_inicio, updated_at: new Date().toISOString() })
      .eq("id", input.cambio_carta_id);

    return { ok: true, data: undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[cambios-carta][mover-bloque]", msg);
    return { ok: false, error: msg };
  }
}

// ──────────────────────────────────────────────────────────────
// Borrar cambio de carta (cascade borra semanas)
// ──────────────────────────────────────────────────────────────
export async function deleteCambioCarta(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase
      .from("cambios_carta")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true, data: undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[cambios-carta][delete]", msg);
    return { ok: false, error: msg };
  }
}

// ──────────────────────────────────────────────────────────────
// Actualizar nombre / notas / color de una semana
// ──────────────────────────────────────────────────────────────
export async function updateSemana(input: {
  semana_id: string;
  fase_nombre?: string;
  color?: FaseColor;
  notas?: string | null;
  es_oficial?: boolean;
}): Promise<ActionResult<CambioCartaSemana>> {
  try {
    const { supabase } = await getAppContext();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.fase_nombre !== undefined) patch.fase_nombre = input.fase_nombre;
    if (input.color !== undefined) patch.color = input.color;
    if (input.notas !== undefined) patch.notas = input.notas;
    if (input.es_oficial !== undefined) patch.es_oficial = input.es_oficial;

    const { data, error } = await supabase
      .from("cambios_carta_semana")
      .update(patch)
      .eq("id", input.semana_id)
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data: data as CambioCartaSemana };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[cambios-carta][update-semana]", msg);
    return { ok: false, error: msg };
  }
}
