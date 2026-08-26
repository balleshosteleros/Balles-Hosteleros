"use server";

/**
 * Periodo de prueba: apertura, evaluaciones y decisión de continuidad.
 *
 * El periodo se abre solo al pasar al trabajador a la fase «Prueba» y genera
 * de una vez sus hitos de validación (2 o 3, configurable). RRHH puntúa cada
 * hito de 0 a 10; al final el sistema calcula la media, la compara con la nota
 * de corte y RECOMIENDA. La decisión de continuidad la firma siempre una
 * persona: nada aquí despide ni confirma a nadie de forma automática.
 */

import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/supabase/get-context";
import {
  calcularNotaFinal,
  calcularProgreso,
  fechasEvaluaciones,
  resumirDecision,
  type DecisionPrueba,
  type EvaluacionPrueba,
  type PeriodoPrueba,
  type ProgresoPrueba,
  type ResumenDecision,
} from "@/features/rrhh/data/periodo-prueba";

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface FilaEvaluacion {
  id: string;
  numero: number;
  fecha_prevista: string;
  estado: string;
  nota: number | null;
  comentario: string | null;
  evaluado_por: string | null;
  evaluado_at: string | null;
}

interface FilaPeriodo {
  id: string;
  empresa_id: string;
  empleado_id: string | null;
  candidato_id: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  duracion_dias: number;
  nota_final: number | null;
  nota_corte: number;
  decision: string;
  decidido_at: string | null;
  decision_motivo: string | null;
  empleado_prueba_evaluaciones?: FilaEvaluacion[] | null;
}

const SELECT_PERIODO = `
  id, empresa_id, empleado_id, candidato_id, fecha_inicio, fecha_fin,
  duracion_dias, nota_final, nota_corte, decision, decidido_at, decision_motivo,
  empleado_prueba_evaluaciones (
    id, numero, fecha_prevista, estado, nota, comentario, evaluado_por, evaluado_at
  )
`;

function mapEvaluacion(f: FilaEvaluacion): EvaluacionPrueba {
  return {
    id: f.id,
    numero: Number(f.numero),
    fechaPrevista: f.fecha_prevista,
    estado: f.estado === "completada" ? "completada" : "pendiente",
    nota: f.nota === null ? null : Number(f.nota),
    comentario: f.comentario,
    evaluadoPor: f.evaluado_por,
    evaluadoAt: f.evaluado_at,
  };
}

function mapPeriodo(f: FilaPeriodo): PeriodoPrueba {
  const evaluaciones = (f.empleado_prueba_evaluaciones ?? [])
    .map(mapEvaluacion)
    .sort((a, b) => a.numero - b.numero);
  return {
    id: f.id,
    empresaId: f.empresa_id,
    empleadoId: f.empleado_id,
    candidatoId: f.candidato_id,
    fechaInicio: f.fecha_inicio,
    fechaFin: f.fecha_fin,
    duracionDias: Number(f.duracion_dias),
    notaFinal: f.nota_final === null ? null : Number(f.nota_final),
    notaCorte: Number(f.nota_corte),
    decision: (f.decision as DecisionPrueba) ?? "pendiente",
    decididoAt: f.decidido_at,
    decisionMotivo: f.decision_motivo,
    evaluaciones,
  };
}

export interface PeriodoPruebaVista {
  periodo: PeriodoPrueba;
  progreso: ProgresoPrueba;
  resumen: ResumenDecision;
}

function componerVista(periodo: PeriodoPrueba): PeriodoPruebaVista {
  return {
    periodo,
    progreso: calcularProgreso(periodo.fechaInicio, periodo.duracionDias, hoyIso()),
    resumen: resumirDecision(periodo.evaluaciones, periodo.notaCorte),
  };
}

// ─── Apertura ────────────────────────────────────────────────────────────────

/**
 * Abre el periodo de prueba de un trabajador y crea sus hitos de validación.
 *
 * Idempotente: si ya tiene un periodo abierto lo devuelve tal cual, sin
 * duplicar hitos. Se invoca al mover al candidato a la fase «Prueba».
 */
export async function abrirPeriodoPrueba(input: {
  empleadoId: string | null;
  candidatoId: string | null;
  /** Por defecto hoy. Formato YYYY-MM-DD. */
  fechaInicio?: string;
}): Promise<{ ok: true; periodo: PeriodoPruebaVista } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    if (!input.empleadoId && !input.candidatoId) {
      return { ok: false, error: "Falta el trabajador" };
    }

    // ¿Ya hay uno abierto? No se duplica.
    let existente = supabase
      .from("empleado_periodo_prueba")
      .select(SELECT_PERIODO)
      .eq("empresa_id", empresaId)
      .eq("decision", "pendiente");
    existente = input.empleadoId
      ? existente.eq("empleado_id", input.empleadoId)
      : existente.eq("candidato_id", input.candidatoId as string);
    const { data: yaAbierto } = await existente.maybeSingle();
    if (yaAbierto) {
      return { ok: true, periodo: componerVista(mapPeriodo(yaAbierto as FilaPeriodo)) };
    }

    // Config de la empresa (duración, nº de hitos, nota de corte).
    const { data: cfg } = await supabase
      .from("reclutamiento_config")
      .select("prueba_duracion_dias, prueba_evaluaciones_num, prueba_nota_corte")
      .eq("empresa_id", empresaId)
      .maybeSingle();

    const duracion = Number(cfg?.prueba_duracion_dias ?? 30);
    const numEval = Number(cfg?.prueba_evaluaciones_num ?? 3);
    const notaCorte = Number(cfg?.prueba_nota_corte ?? 6);
    const fechaInicio = input.fechaInicio ?? hoyIso();
    const fechas = fechasEvaluaciones(fechaInicio, duracion, numEval);
    const fechaFin = fechas[fechas.length - 1];

    const { data: creado, error } = await supabase
      .from("empleado_periodo_prueba")
      .insert({
        empresa_id: empresaId,
        empleado_id: input.empleadoId,
        candidato_id: input.candidatoId,
        fecha_inicio: fechaInicio,
        duracion_dias: duracion,
        fecha_fin: fechaFin,
        nota_corte: notaCorte,
      })
      .select("id")
      .single();
    if (error) throw error;

    const periodoId = creado.id as string;
    const { error: errEval } = await supabase.from("empleado_prueba_evaluaciones").insert(
      fechas.map((fecha, i) => ({
        periodo_id: periodoId,
        empresa_id: empresaId,
        numero: i + 1,
        fecha_prevista: fecha,
      })),
    );
    if (errEval) throw errEval;

    const { data: completo } = await supabase
      .from("empleado_periodo_prueba")
      .select(SELECT_PERIODO)
      .eq("id", periodoId)
      .single();

    revalidatePath("/rrhh/reclutamiento");
    return { ok: true, periodo: componerVista(mapPeriodo(completo as FilaPeriodo)) };
  } catch (err) {
    console.error("[rrhh] abrirPeriodoPrueba:", err);
    return { ok: false, error: "No se pudo abrir el periodo de prueba" };
  }
}

// ─── Consulta ────────────────────────────────────────────────────────────────

/** Periodo de prueba (abierto o el último cerrado) de un trabajador. */
export async function getPeriodoPrueba(input: {
  empleadoId?: string | null;
  candidatoId?: string | null;
}): Promise<{ ok: boolean; data: PeriodoPruebaVista | null }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, data: null };
    if (!input.empleadoId && !input.candidatoId) return { ok: true, data: null };

    let q = supabase
      .from("empleado_periodo_prueba")
      .select(SELECT_PERIODO)
      .eq("empresa_id", empresaId);
    q = input.empleadoId
      ? q.eq("empleado_id", input.empleadoId)
      : q.eq("candidato_id", input.candidatoId as string);

    // El abierto manda; si no hay, el más reciente.
    const { data } = await q.order("created_at", { ascending: false }).limit(5);
    const filas = (data ?? []) as FilaPeriodo[];
    if (filas.length === 0) return { ok: true, data: null };
    const elegida = filas.find((f) => f.decision === "pendiente") ?? filas[0];
    return { ok: true, data: componerVista(mapPeriodo(elegida)) };
  } catch (err) {
    console.error("[rrhh] getPeriodoPrueba:", err);
    return { ok: false, data: null };
  }
}

// ─── Evaluación de un hito ───────────────────────────────────────────────────

/**
 * Guarda la nota de un hito de validación. Recalcula la nota final del periodo
 * (media de los hitos completados) para que el indicador esté siempre al día.
 */
export async function evaluarHitoPrueba(input: {
  evaluacionId: string;
  nota: number;
  comentario?: string;
}): Promise<{ ok: true; periodo: PeriodoPruebaVista } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || !userId) return { ok: false, error: "No autenticado" };

    const nota = Math.round(Number(input.nota) * 10) / 10;
    if (!Number.isFinite(nota) || nota < 0 || nota > 10) {
      return { ok: false, error: "La nota debe estar entre 0 y 10" };
    }

    const { data: evalRow, error: errGet } = await supabase
      .from("empleado_prueba_evaluaciones")
      .select("id, periodo_id")
      .eq("id", input.evaluacionId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (errGet) throw errGet;
    if (!evalRow) return { ok: false, error: "Evaluación no encontrada" };

    const { error } = await supabase
      .from("empleado_prueba_evaluaciones")
      .update({
        estado: "completada",
        nota,
        comentario: input.comentario?.trim() || null,
        evaluado_por: userId,
        evaluado_at: new Date().toISOString(),
      })
      .eq("id", input.evaluacionId)
      .eq("empresa_id", empresaId);
    if (error) throw error;

    const periodoId = evalRow.periodo_id as string;
    const { data: completo } = await supabase
      .from("empleado_periodo_prueba")
      .select(SELECT_PERIODO)
      .eq("id", periodoId)
      .single();
    const periodo = mapPeriodo(completo as FilaPeriodo);

    // La nota final se recalcula y persiste: el cron y la ficha la leen de aquí.
    const notaFinal = calcularNotaFinal(periodo.evaluaciones);
    await supabase
      .from("empleado_periodo_prueba")
      .update({ nota_final: notaFinal })
      .eq("id", periodoId);
    periodo.notaFinal = notaFinal;

    revalidatePath("/rrhh/reclutamiento");
    return { ok: true, periodo: componerVista(periodo) };
  } catch (err) {
    console.error("[rrhh] evaluarHitoPrueba:", err);
    return { ok: false, error: "No se pudo guardar la evaluación" };
  }
}

// ─── Decisión final ──────────────────────────────────────────────────────────

/**
 * Cierra el periodo con la decisión de continuidad. La toma una persona: el
 * sistema solo aportó la nota y la recomendación.
 *
 * No mueve al trabajador de fase ni le da de baja — eso sigue siendo un acto
 * explícito de RRHH desde el pipeline, con su propio flujo de offboarding.
 */
export async function decidirPeriodoPrueba(input: {
  periodoId: string;
  decision: Exclude<DecisionPrueba, "pendiente">;
  motivo?: string;
}): Promise<{ ok: true; periodo: PeriodoPruebaVista } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || !userId) return { ok: false, error: "No autenticado" };
    if (input.decision !== "continua" && input.decision !== "no_continua") {
      return { ok: false, error: "Decisión no válida" };
    }

    const { data: periodoRow } = await supabase
      .from("empleado_periodo_prueba")
      .select("id, decision")
      .eq("id", input.periodoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!periodoRow) return { ok: false, error: "Periodo no encontrado" };
    if (periodoRow.decision !== "pendiente") {
      return { ok: false, error: "Este periodo de prueba ya está cerrado" };
    }

    const { error } = await supabase
      .from("empleado_periodo_prueba")
      .update({
        decision: input.decision,
        decidido_por: userId,
        decidido_at: new Date().toISOString(),
        decision_motivo: input.motivo?.trim() || null,
      })
      .eq("id", input.periodoId)
      .eq("empresa_id", empresaId);
    if (error) throw error;

    const { data: completo } = await supabase
      .from("empleado_periodo_prueba")
      .select(SELECT_PERIODO)
      .eq("id", input.periodoId)
      .single();

    revalidatePath("/rrhh/reclutamiento");
    revalidatePath("/mi-panel");
    return { ok: true, periodo: componerVista(mapPeriodo(completo as FilaPeriodo)) };
  } catch (err) {
    console.error("[rrhh] decidirPeriodoPrueba:", err);
    return { ok: false, error: "No se pudo guardar la decisión" };
  }
}
