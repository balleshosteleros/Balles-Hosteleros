"use server";

/**
 * Pipeline de Producto — lectura y escritura del tablero comercial.
 *
 * El tablero se carga entero de una vez (embudos, columnas y tarjetas) porque
 * se pinta entero: mil seiscientas tarjetas repartidas en cinco columnas, con
 * su suma por columna arriba. Ir a buscarlas columna por columna sería el mismo
 * trabajo partido en cinco viajes.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAppContext } from "@/lib/supabase/get-context";
import { friendlyError } from "@/shared/lib/friendly-errors";
import { leerTodas } from "@/shared/lib/supabase-paginado";
import type {
  Oportunidad,
  OportunidadEstado,
  Pipeline,
  PipelineFase,
  TableroPipeline,
} from "../types";

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

function revalidar() {
  revalidatePath("/producto/pipeline");
}

// ─────────────────────────── Tablero ───────────────────────────

/**
 * Todo lo que hace falta para pintar el tablero. Sin `pipelineId` se abre el
 * primer embudo de la empresa, que es el que se estaba mirando siempre.
 */
export async function cargarTablero(
  pipelineId?: string,
): Promise<ActionResult<TableroPipeline>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const { data: pipelinesData, error: errPipelines } = await supabase
      .from("pipelines")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("orden")
      .order("nombre");

    if (errPipelines) {
      console.error("[pipeline][cargarTablero] pipelines:", errPipelines.message);
      return { ok: false, error: "No se pudo cargar el pipeline." };
    }

    const pipelines = (pipelinesData ?? []) as Pipeline[];
    const pipeline =
      pipelines.find((p) => p.id === pipelineId) ?? pipelines.find((p) => p.activo) ?? pipelines[0] ?? null;

    if (!pipeline) {
      return { ok: true, data: { pipelines, pipeline: null, fases: [], oportunidades: [] } };
    }

    const { data: fasesData, error: errFases } = await supabase
      .from("pipeline_fases")
      .select("*")
      .eq("pipeline_id", pipeline.id)
      .order("orden");

    if (errFases) {
      console.error("[pipeline][cargarTablero] fases:", errFases.message);
      return { ok: false, error: "No se pudieron cargar las fases." };
    }

    // El embudo real pasa de mil seiscientas tarjetas y Supabase corta en mil
    // sin avisar: sin paginar, las sumas de las columnas saldrían cortas.
    const oportunidades = await leerTodas<Oportunidad>(() =>
      supabase
        .from("pipeline_oportunidades")
        .select("*")
        .eq("pipeline_id", pipeline.id)
        .order("created_at", { ascending: false }),
    );

    return {
      ok: true,
      data: {
        pipelines,
        pipeline,
        fases: (fasesData ?? []) as PipelineFase[],
        oportunidades,
      },
    };
  } catch (err) {
    console.error("[pipeline][cargarTablero] fatal:", err);
    return { ok: false, error: friendlyError(err, "cargarTablero") };
  }
}

// ─────────────────────────── Oportunidades ───────────────────────────

const oportunidadSchema = z.object({
  id: z.string().guid().optional(),
  pipeline_id: z.string().guid(),
  fase_id: z.string().guid(),
  nombre: z.string().trim().min(1, "Ponle nombre a la oportunidad").max(120),
  telefono: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().max(160).nullable().optional(),
  valor: z.number().min(0).max(9_999_999),
  fuente: z.string().trim().max(120).nullable().optional(),
  asignado_a: z.string().trim().max(120).nullable().optional(),
  estado: z.enum(["ABIERTA", "GANADA", "PERDIDA", "ABANDONADA"]),
  motivo_cierre: z.string().trim().max(300).nullable().optional(),
  notas: z.string().trim().max(5000).nullable().optional(),
  etiquetas: z.array(z.string().trim().max(80)).max(50),
  cierre_previsto: z.string().trim().max(10).nullable().optional(),
});

export type OportunidadInput = z.infer<typeof oportunidadSchema>;

export async function guardarOportunidad(
  input: OportunidadInput,
): Promise<ActionResult<string>> {
  try {
    const parsed = oportunidadSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
    }
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const v = parsed.data;
    const fila = {
      empresa_id: empresaId,
      pipeline_id: v.pipeline_id,
      fase_id: v.fase_id,
      nombre: v.nombre,
      telefono: v.telefono || null,
      email: v.email || null,
      valor: v.valor,
      fuente: v.fuente || null,
      asignado_a: v.asignado_a || null,
      estado: v.estado,
      motivo_cierre: v.motivo_cierre || null,
      notas: v.notas || null,
      etiquetas: v.etiquetas,
      cierre_previsto: v.cierre_previsto || null,
      updated_at: new Date().toISOString(),
    };

    if (v.id) {
      // La fecha de fase y la de estado solo se mueven si cambia lo que miden:
      // guardar el teléfono no puede hacer que la tarjeta parezca recién movida.
      const { data: previa, error: errPrevia } = await supabase
        .from("pipeline_oportunidades")
        .select("fase_id, estado")
        .eq("id", v.id)
        .eq("empresa_id", empresaId)
        .single();
      if (errPrevia) {
        console.error("[pipeline][guardarOportunidad] previa:", errPrevia.message);
        return { ok: false, error: "No se encontró la oportunidad." };
      }

      const ahora = new Date().toISOString();
      const { error } = await supabase
        .from("pipeline_oportunidades")
        .update({
          ...fila,
          ...(previa.fase_id !== v.fase_id ? { fase_at: ahora } : {}),
          ...(previa.estado !== v.estado ? { estado_at: ahora } : {}),
        })
        .eq("id", v.id)
        .eq("empresa_id", empresaId);

      if (error) {
        console.error("[pipeline][guardarOportunidad] update:", error.message);
        return { ok: false, error: "No se pudo guardar la oportunidad." };
      }
      revalidar();
      return { ok: true, data: v.id };
    }

    const { data, error } = await supabase
      .from("pipeline_oportunidades")
      .insert(fila)
      .select("id")
      .single();

    if (error) {
      console.error("[pipeline][guardarOportunidad] insert:", error.message);
      return { ok: false, error: "No se pudo crear la oportunidad." };
    }
    revalidar();
    return { ok: true, data: data.id as string };
  } catch (err) {
    console.error("[pipeline][guardarOportunidad] fatal:", err);
    return { ok: false, error: friendlyError(err, "guardarOportunidad") };
  }
}

/** Arrastrar una tarjeta a otra columna. */
export async function moverOportunidad(
  id: string,
  faseId: string,
): Promise<ActionResult> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const ahora = new Date().toISOString();
    const { error } = await supabase
      .from("pipeline_oportunidades")
      .update({ fase_id: faseId, fase_at: ahora, updated_at: ahora })
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("[pipeline][moverOportunidad]", error.message);
      return { ok: false, error: "No se pudo mover la oportunidad." };
    }
    revalidar();
    return { ok: true };
  } catch (err) {
    console.error("[pipeline][moverOportunidad] fatal:", err);
    return { ok: false, error: friendlyError(err, "moverOportunidad") };
  }
}

/** Marcar cómo acabó: ganada, perdida, abandonada o de vuelta a abierta. */
export async function cambiarEstadoOportunidad(
  id: string,
  estado: OportunidadEstado,
  motivo?: string | null,
): Promise<ActionResult> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const ahora = new Date().toISOString();
    const { error } = await supabase
      .from("pipeline_oportunidades")
      .update({
        estado,
        // Volver a abrirla borra el motivo: si no, quedaría diciendo por qué se
        // perdió una oportunidad que está viva.
        motivo_cierre: estado === "ABIERTA" ? null : (motivo?.trim() || null),
        estado_at: ahora,
        updated_at: ahora,
      })
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("[pipeline][cambiarEstadoOportunidad]", error.message);
      return { ok: false, error: "No se pudo cambiar el estado." };
    }
    revalidar();
    return { ok: true };
  } catch (err) {
    console.error("[pipeline][cambiarEstadoOportunidad] fatal:", err);
    return { ok: false, error: friendlyError(err, "cambiarEstadoOportunidad") };
  }
}

export async function borrarOportunidad(id: string): Promise<ActionResult> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const { error } = await supabase
      .from("pipeline_oportunidades")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("[pipeline][borrarOportunidad]", error.message);
      return { ok: false, error: "No se pudo borrar la oportunidad." };
    }
    revalidar();
    return { ok: true };
  } catch (err) {
    console.error("[pipeline][borrarOportunidad] fatal:", err);
    return { ok: false, error: friendlyError(err, "borrarOportunidad") };
  }
}

// ─────────────────────────── Configuración ───────────────────────────

const pipelineSchema = z.object({
  id: z.string().guid().optional(),
  nombre: z.string().trim().min(1, "Ponle nombre al pipeline").max(80),
  activo: z.boolean(),
});

export type PipelineInput = z.infer<typeof pipelineSchema>;

export async function guardarPipeline(input: PipelineInput): Promise<ActionResult<string>> {
  try {
    const parsed = pipelineSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
    }
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const v = parsed.data;
    if (v.id) {
      const { error } = await supabase
        .from("pipelines")
        .update({ nombre: v.nombre, activo: v.activo, updated_at: new Date().toISOString() })
        .eq("id", v.id)
        .eq("empresa_id", empresaId);
      if (error) {
        console.error("[pipeline][guardarPipeline] update:", error.message);
        return { ok: false, error: "No se pudo guardar el pipeline." };
      }
      revalidar();
      return { ok: true, data: v.id };
    }

    const { data, error } = await supabase
      .from("pipelines")
      .insert({ empresa_id: empresaId, nombre: v.nombre, activo: v.activo })
      .select("id")
      .single();
    if (error) {
      console.error("[pipeline][guardarPipeline] insert:", error.message);
      return { ok: false, error: "No se pudo crear el pipeline." };
    }
    revalidar();
    return { ok: true, data: data.id as string };
  } catch (err) {
    console.error("[pipeline][guardarPipeline] fatal:", err);
    return { ok: false, error: friendlyError(err, "guardarPipeline") };
  }
}

const faseSchema = z.object({
  id: z.string().guid().optional(),
  pipeline_id: z.string().guid(),
  nombre: z.string().trim().min(1, "Ponle nombre a la fase").max(60),
  icono: z.string().trim().max(8).nullable().optional(),
  color: z.string().trim().max(20).nullable().optional(),
  orden: z.number().int().min(0).max(99),
  activa: z.boolean(),
});

export type FaseInput = z.infer<typeof faseSchema>;

export async function guardarFase(input: FaseInput): Promise<ActionResult<string>> {
  try {
    const parsed = faseSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
    }
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    // La fase cuelga del pipeline; se comprueba que el pipeline es de esta
    // empresa antes de escribir, porque `pipeline_fases` no lleva `empresa_id`.
    const { data: duenyo, error: errDuenyo } = await supabase
      .from("pipelines")
      .select("id")
      .eq("id", parsed.data.pipeline_id)
      .eq("empresa_id", empresaId)
      .single();
    if (errDuenyo || !duenyo) return { ok: false, error: "Pipeline no encontrado." };

    const v = parsed.data;
    const fila = {
      pipeline_id: v.pipeline_id,
      nombre: v.nombre,
      icono: v.icono || null,
      color: v.color || null,
      orden: v.orden,
      activa: v.activa,
      updated_at: new Date().toISOString(),
    };

    if (v.id) {
      const { error } = await supabase.from("pipeline_fases").update(fila).eq("id", v.id);
      if (error) {
        console.error("[pipeline][guardarFase] update:", error.message);
        return { ok: false, error: "No se pudo guardar la fase." };
      }
      revalidar();
      return { ok: true, data: v.id };
    }

    const { data, error } = await supabase
      .from("pipeline_fases")
      .insert(fila)
      .select("id")
      .single();
    if (error) {
      console.error("[pipeline][guardarFase] insert:", error.message);
      return { ok: false, error: "No se pudo crear la fase." };
    }
    revalidar();
    return { ok: true, data: data.id as string };
  } catch (err) {
    console.error("[pipeline][guardarFase] fatal:", err);
    return { ok: false, error: friendlyError(err, "guardarFase") };
  }
}

/**
 * Borrar una columna. La base de datos no deja borrarla si tiene tarjetas
 * dentro (`on delete restrict`): antes hay que vaciarla. Se avisa con esas
 * palabras en vez de soltar el error de Postgres.
 */
export async function borrarFase(id: string): Promise<ActionResult> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const { count, error: errCount } = await supabase
      .from("pipeline_oportunidades")
      .select("id", { count: "exact", head: true })
      .eq("fase_id", id)
      .eq("empresa_id", empresaId);

    if (errCount) {
      console.error("[pipeline][borrarFase] count:", errCount.message);
      return { ok: false, error: "No se pudo comprobar la fase." };
    }
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: `La fase tiene ${count} oportunidades. Muévelas a otra fase antes de borrarla.`,
      };
    }

    const { error } = await supabase.from("pipeline_fases").delete().eq("id", id);
    if (error) {
      console.error("[pipeline][borrarFase]", error.message);
      return { ok: false, error: "No se pudo borrar la fase." };
    }
    revalidar();
    return { ok: true };
  } catch (err) {
    console.error("[pipeline][borrarFase] fatal:", err);
    return { ok: false, error: friendlyError(err, "borrarFase") };
  }
}
