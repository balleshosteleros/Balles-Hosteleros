"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import type {
  ActionResult, Receta, Ingrediente, HistorialEntry,
  CrearRecetaInput, MoverRecetaInput, EstadoGeneral,
} from "../types";
import { ensureFasesDefault } from "../services/seed-fases";
import { crearTareaFase } from "./tareas-actions";

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

export interface RecetaConExtras extends Receta {
  fase_nombre: string | null;
  fase_color: string | null;
  sub_estado_nombre: string | null;
  dias_en_fase: number;
  ingredientes: Ingrediente[];
}

// ──────────────────────────────────────────────────────────────
// Listar recetas con datos de fase
// ──────────────────────────────────────────────────────────────
export async function listRecetas(filtros?: {
  estado_general?: EstadoGeneral;
  busqueda?: string;
}): Promise<ActionResult<RecetaConExtras[]>> {
  try {
    await ensureFasesDefault();

    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa" };

    let query = supabase
      .from("nuevas_recetas")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });

    if (filtros?.estado_general) {
      query = query.eq("estado_general", filtros.estado_general);
    }
    if (filtros?.busqueda && filtros.busqueda.trim()) {
      query = query.ilike("nombre", `%${filtros.busqueda.trim()}%`);
    }

    const { data: recetas, error } = await query;
    if (error) throw error;

    const recetaIds = (recetas ?? []).map((r) => r.id);
    if (recetaIds.length === 0) return { ok: true, data: [] };

    const [faseRes, subRes, ingRes] = await Promise.all([
      supabase.from("nueva_receta_fase").select("id, nombre, color").eq("empresa_id", empresaId),
      supabase.from("nueva_receta_sub_estado").select("id, nombre"),
      supabase.from("nueva_receta_ingrediente").select("*").in("receta_id", recetaIds),
    ]);

    const faseMap = new Map((faseRes.data ?? []).map((f) => [f.id, f]));
    const subMap = new Map((subRes.data ?? []).map((s) => [s.id, s]));
    const ingByReceta = new Map<string, Ingrediente[]>();
    for (const ing of (ingRes.data ?? []) as Ingrediente[]) {
      const arr = ingByReceta.get(ing.receta_id) ?? [];
      arr.push(ing);
      ingByReceta.set(ing.receta_id, arr);
    }

    const now = Date.now();
    const result: RecetaConExtras[] = (recetas ?? []).map((r) => {
      const fase = r.fase_id ? faseMap.get(r.fase_id) : null;
      const sub = r.sub_estado_id ? subMap.get(r.sub_estado_id) : null;
      const fecha = r.fecha_fase_inicio ? new Date(r.fecha_fase_inicio).getTime() : null;
      const dias = fecha ? Math.floor((now - fecha) / (1000 * 60 * 60 * 24)) : 0;
      return {
        ...(r as Receta),
        fase_nombre: (fase?.nombre as string) ?? null,
        fase_color: (fase?.color as string) ?? null,
        sub_estado_nombre: (sub?.nombre as string) ?? null,
        dias_en_fase: dias,
        ingredientes: ingByReceta.get(r.id) ?? [],
      };
    });

    return { ok: true, data: result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[recetas][list]", msg);
    return { ok: false, error: msg };
  }
}

// ──────────────────────────────────────────────────────────────
// Crear receta (fase 1: Propuesta)
// ──────────────────────────────────────────────────────────────
export async function createReceta(
  input: CrearRecetaInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    await ensureFasesDefault();
    const { supabase, userId, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa" };

    // Buscar fase inicial (orden=1)
    const { data: faseInicial } = await supabase
      .from("nueva_receta_fase")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("orden", 1)
      .maybeSingle();

    const nombre = await getNombreUsuario();

    const { data, error } = await supabase
      .from("nuevas_recetas")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre.trim(),
        descripcion: input.descripcion?.trim() ?? null,
        destino: input.destino,
        fase_id: faseInicial?.id ?? null,
        fecha_fase_inicio: new Date().toISOString(),
        estado_general: "en_progreso",
        propuesto_por: userId,
        propuesto_por_nombre: nombre ?? "Desconocido",
        ft_descripcion: input.ft_descripcion ?? null,
        ft_elaboracion: input.ft_elaboracion ?? null,
        ft_alergenos: input.ft_alergenos ?? [],
        ft_partida: input.ft_partida ?? null,
        ft_tiempo_preparacion: input.ft_tiempo_preparacion ?? null,
        ft_porciones: input.ft_porciones ?? 1,
        ft_pvp_propuesto: input.ft_pvp_propuesto ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;

    // Insertar ingredientes si vienen
    if (input.ingredientes?.length) {
      const rows = input.ingredientes.map((ing, idx) => ({
        receta_id: data.id,
        producto_id: ing.producto_id ?? null,
        nombre_libre: ing.nombre_libre ?? null,
        cantidad: ing.cantidad ?? null,
        unidad: ing.unidad ?? "g",
        prioridad: ing.prioridad,
        orden: idx,
      }));
      await supabase.from("nueva_receta_ingrediente").insert(rows);
    }

    return { ok: true, data: { id: data.id as string } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[recetas][create]", msg);
    return { ok: false, error: msg };
  }
}

// ──────────────────────────────────────────────────────────────
// Actualizar receta (datos generales + ficha técnica borrador)
// ──────────────────────────────────────────────────────────────
export async function updateReceta(
  id: string,
  patch: Partial<Receta>,
): Promise<ActionResult> {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase
      .from("nuevas_recetas")
      .update(patch)
      .eq("id", id);
    if (error) throw error;
    return { ok: true, data: undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[recetas][update]", msg);
    return { ok: false, error: msg };
  }
}

// ──────────────────────────────────────────────────────────────
// Mover receta entre fases (con historial + tarea al responsable)
// ──────────────────────────────────────────────────────────────
export async function moverReceta(
  input: MoverRecetaInput,
): Promise<ActionResult<{ historial_id: string }>> {
  try {
    const { supabase, userId } = await getAppContext();

    const { data: receta, error: rErr } = await supabase
      .from("nuevas_recetas")
      .select("id, fase_id, empresa_id, nombre")
      .eq("id", input.recetaId)
      .single();
    if (rErr || !receta) throw rErr ?? new Error("Receta no encontrada");

    const [{ data: faseNueva }, { data: faseAnterior }] = await Promise.all([
      supabase
        .from("nueva_receta_fase")
        .select("id, nombre, responsable_user_id")
        .eq("id", input.faseDestinoId)
        .single(),
      receta.fase_id
        ? supabase
            .from("nueva_receta_fase")
            .select("id, nombre")
            .eq("id", receta.fase_id)
            .single()
        : Promise.resolve({ data: null }),
    ]);

    if (!faseNueva) throw new Error("Fase destino no encontrada");

    const usuario_nombre = await getNombreUsuario();

    // 1) Actualizar receta
    await supabase
      .from("nuevas_recetas")
      .update({
        fase_id: input.faseDestinoId,
        sub_estado_id: input.subEstadoId ?? null,
        fecha_fase_inicio: new Date().toISOString(),
      })
      .eq("id", input.recetaId);

    // 2) Crear tarea si se pide comunicar
    let tareaId: string | null = null;
    if (input.comunicar && faseNueva.responsable_user_id) {
      const tareaRes = await crearTareaFase({
        user_id: faseNueva.responsable_user_id as string,
        empresa_id: receta.empresa_id as string,
        titulo: `Receta: ${receta.nombre} — fase "${faseNueva.nombre}"`,
        descripcion: input.nota ?? null,
        receta_id: input.recetaId,
      });
      if (tareaRes.ok) tareaId = tareaRes.data.id;
    }

    // 3) Insertar historial
    const { data: hist, error: hErr } = await supabase
      .from("nueva_receta_historial")
      .insert({
        receta_id: input.recetaId,
        fase_anterior_id: receta.fase_id,
        fase_anterior_nombre: (faseAnterior as unknown as { nombre?: string })?.nombre ?? null,
        fase_nueva_id: input.faseDestinoId,
        fase_nueva_nombre: faseNueva.nombre,
        sub_estado_nuevo_id: input.subEstadoId ?? null,
        usuario_id: userId,
        usuario_nombre,
        nota: input.nota ?? null,
        comunicado: Boolean(input.comunicar),
        tarea_id: tareaId,
      })
      .select("id")
      .single();
    if (hErr) throw hErr;

    return { ok: true, data: { historial_id: hist.id as string } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[recetas][mover]", msg);
    return { ok: false, error: msg };
  }
}

// ──────────────────────────────────────────────────────────────
// Cambiar estado general (En progreso / Aprobada / Archivada)
// ──────────────────────────────────────────────────────────────
export async function cambiarEstadoGeneral(
  id: string,
  estado: EstadoGeneral,
  motivo?: string,
): Promise<ActionResult> {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase
      .from("nuevas_recetas")
      .update({
        estado_general: estado,
        motivo_archivado: estado === "archivada" ? (motivo ?? null) : null,
      })
      .eq("id", id);
    if (error) throw error;
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

// ──────────────────────────────────────────────────────────────
// Historial
// ──────────────────────────────────────────────────────────────
export async function listHistorial(
  recetaId: string,
): Promise<ActionResult<HistorialEntry[]>> {
  try {
    const { supabase } = await getAppContext();
    const { data, error } = await supabase
      .from("nueva_receta_historial")
      .select("*")
      .eq("receta_id", recetaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { ok: true, data: (data as HistorialEntry[]) ?? [] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

// ──────────────────────────────────────────────────────────────
// Favorita toggle
// ──────────────────────────────────────────────────────────────
export async function toggleFavorita(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await getAppContext();
    const { data: cur } = await supabase
      .from("nuevas_recetas")
      .select("favorita")
      .eq("id", id)
      .single();
    const next = !cur?.favorita;
    const { error } = await supabase
      .from("nuevas_recetas")
      .update({ favorita: next })
      .eq("id", id);
    if (error) throw error;
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

// ──────────────────────────────────────────────────────────────
// Ingredientes (del borrador)
// ──────────────────────────────────────────────────────────────
export async function upsertIngredientes(
  recetaId: string,
  ingredientes: Array<{
    producto_id?: string | null;
    nombre_libre?: string | null;
    cantidad?: number | null;
    unidad?: string;
    prioridad: Ingrediente["prioridad"];
  }>,
): Promise<ActionResult> {
  try {
    const { supabase } = await getAppContext();
    // Estrategia simple: borrar + insertar (las recetas tienen ~10 ingredientes max)
    await supabase.from("nueva_receta_ingrediente").delete().eq("receta_id", recetaId);
    if (ingredientes.length > 0) {
      const rows = ingredientes.map((ing, idx) => ({
        ...ing,
        receta_id: recetaId,
        orden: idx,
      }));
      const { error } = await supabase.from("nueva_receta_ingrediente").insert(rows);
      if (error) throw error;
    }
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}
