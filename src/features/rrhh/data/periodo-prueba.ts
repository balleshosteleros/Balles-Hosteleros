// ─── Periodo de prueba: modelo y cálculos ───────────────────────────────────
// Lógica pura y determinista, sin acceso a BD. Fuente única del cálculo de
// progreso, fechas de los hitos y nota final, usada tanto por el servidor
// (al guardar y al avisar) como por la UI (al pintar el indicador).

export type DecisionPrueba = "pendiente" | "continua" | "no_continua";
export type EstadoEvaluacion = "pendiente" | "completada";

export interface EvaluacionPrueba {
  id: string;
  numero: number;
  fechaPrevista: string; // YYYY-MM-DD
  estado: EstadoEvaluacion;
  /** 0–10. NULL mientras está pendiente: «sin evaluar» nunca es un 0. */
  nota: number | null;
  comentario: string | null;
  evaluadoPor: string | null;
  evaluadoAt: string | null;
}

export interface PeriodoPrueba {
  id: string;
  empresaId: string;
  empleadoId: string | null;
  candidatoId: string | null;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string; // YYYY-MM-DD
  duracionDias: number;
  notaFinal: number | null;
  notaCorte: number;
  decision: DecisionPrueba;
  decididoAt: string | null;
  decisionMotivo: string | null;
  evaluaciones: EvaluacionPrueba[];
}

// ─── Fechas ──────────────────────────────────────────────────────────────────

/** Suma días a una fecha YYYY-MM-DD y devuelve YYYY-MM-DD. Sin zona horaria:
 *  son fechas de calendario, no instantes. */
export function sumarDias(fechaIso: string, dias: number): string {
  const [a, m, d] = fechaIso.split("-").map(Number);
  const base = Date.UTC(a, m - 1, d) + dias * 86_400_000;
  return new Date(base).toISOString().slice(0, 10);
}

/** Días de diferencia entre dos fechas de calendario (b − a). */
export function diasEntre(desdeIso: string, hastaIso: string): number {
  const [a1, m1, d1] = desdeIso.split("-").map(Number);
  const [a2, m2, d2] = hastaIso.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

/**
 * Reparte N evaluaciones a lo largo del periodo.
 *
 * Se colocan en fracciones iguales del periodo: con 3 hitos sobre 30 días caen
 * en los días 10, 20 y 30. El último SIEMPRE coincide con el fin del periodo,
 * porque es el que sustenta la decisión de continuidad.
 */
export function fechasEvaluaciones(
  fechaInicio: string,
  duracionDias: number,
  numEvaluaciones: number,
): string[] {
  const n = Math.max(1, Math.min(5, Math.round(numEvaluaciones)));
  const fechas: string[] = [];
  for (let i = 1; i <= n; i++) {
    // El hito i cae en el día (duracion * i / n), redondeado.
    const dia = Math.max(1, Math.round((duracionDias * i) / n));
    fechas.push(sumarDias(fechaInicio, dia));
  }
  return fechas;
}

// ─── Progreso ────────────────────────────────────────────────────────────────

export interface ProgresoPrueba {
  diasTranscurridos: number;
  diasRestantes: number;
  duracionDias: number;
  /** 0–100, saturado en los extremos. */
  progresoPct: number;
  /** El periodo llegó a su fecha de fin. */
  vencido: boolean;
}

export function calcularProgreso(
  fechaInicio: string,
  duracionDias: number,
  hoyIso: string,
): ProgresoPrueba {
  const transcurridosRaw = diasEntre(fechaInicio, hoyIso);
  const diasTranscurridos = Math.max(0, Math.min(duracionDias, transcurridosRaw));
  const diasRestantes = Math.max(0, duracionDias - transcurridosRaw);
  const progresoPct =
    duracionDias <= 0 ? 100 : Math.round((diasTranscurridos / duracionDias) * 100);
  return {
    diasTranscurridos,
    diasRestantes,
    duracionDias,
    progresoPct: Math.max(0, Math.min(100, progresoPct)),
    vencido: transcurridosRaw >= duracionDias,
  };
}

// ─── Nota y recomendación ────────────────────────────────────────────────────

/**
 * Media de las evaluaciones COMPLETADAS, redondeada a 1 decimal.
 * Devuelve null si aún no hay ninguna: «sin evaluar» no es un cero.
 */
export function calcularNotaFinal(evaluaciones: EvaluacionPrueba[]): number | null {
  const notas = evaluaciones
    .filter((e) => e.estado === "completada" && e.nota !== null)
    .map((e) => e.nota as number);
  if (notas.length === 0) return null;
  const media = notas.reduce((s, n) => s + n, 0) / notas.length;
  return Math.round(media * 10) / 10;
}

export type Recomendacion = "apto" | "no_apto" | "sin_datos";

export interface ResumenDecision {
  notaFinal: number | null;
  notaCorte: number;
  recomendacion: Recomendacion;
  evaluacionesCompletadas: number;
  evaluacionesTotales: number;
  /** Faltan hitos por completar: la nota aún no es representativa. */
  incompleto: boolean;
}

/**
 * Resume la situación para que RRHH decida. NUNCA decide por su cuenta:
 * devuelve una recomendación, y la decisión la firma una persona.
 */
export function resumirDecision(
  evaluaciones: EvaluacionPrueba[],
  notaCorte: number,
): ResumenDecision {
  const completadas = evaluaciones.filter((e) => e.estado === "completada").length;
  const notaFinal = calcularNotaFinal(evaluaciones);
  const recomendacion: Recomendacion =
    notaFinal === null ? "sin_datos" : notaFinal >= notaCorte ? "apto" : "no_apto";
  return {
    notaFinal,
    notaCorte,
    recomendacion,
    evaluacionesCompletadas: completadas,
    evaluacionesTotales: evaluaciones.length,
    incompleto: completadas < evaluaciones.length,
  };
}

/** Formatea una nota con coma decimal (formato español). */
export function formatearNota(nota: number | null): string {
  if (nota === null) return "Sin evaluar";
  return nota.toFixed(1).replace(".", ",");
}

export const ETIQUETA_DECISION: Record<DecisionPrueba, string> = {
  pendiente: "Pendiente de decidir",
  continua: "Continúa en la empresa",
  no_continua: "No continúa",
};

export const ETIQUETA_RECOMENDACION: Record<Recomendacion, string> = {
  apto: "Apto",
  no_apto: "No apto",
  sin_datos: "Sin evaluaciones",
};
