// ─── Cuestionarios de vacantes (reclutamiento) ──────────────────────────────
// Forma canónica de una pregunta dentro de `reclutamiento_plantillas_cuestionario.preguntas`
// y del snapshot guardado en `candidato_cuestionario_respuestas.preguntas_snapshot`.
//
// Modelo de nota: cada pregunta vale 1 punto; se acierta si la opción elegida
// está marcada como `correcta`. Nota final = (aciertos / total) * 10 (0–10).

export const MAX_PREGUNTAS_CUESTIONARIO = 10;

/** Máximo de opciones de respuesta por pregunta. */
export const MAX_OPCIONES_PREGUNTA = 5;

/** Único tipo soportado hoy: elección múltiple de una sola respuesta. */
export type TipoPreguntaCuestionario = "eleccion_multiple";

export interface OpcionCuestionario {
  id: string;
  texto: string;
  /** Marca la respuesta correcta (suma 1 punto si el candidato la elige). */
  correcta: boolean;
}

export interface PreguntaCuestionario {
  id: string;
  titulo: string;
  tipo: TipoPreguntaCuestionario;
  obligatoria: boolean;
  opciones: OpcionCuestionario[];
}

export interface CuestionarioVacante {
  id: string;
  empresaId: string;
  nombre: string;
  descripcion: string | null;
  preguntas: PreguntaCuestionario[];
  esDefault: boolean;
  activa: boolean;
  /** True si ya tiene ≥1 respuesta de candidato (entonces no se puede editar). */
  usado?: boolean;
}

/** Respuestas del candidato: { preguntaId: opcionId }. */
export type RespuestasCuestionario = Record<string, string>;

export interface ResultadoCuestionario {
  aciertos: number;
  total: number;
  /** Nota 0–10 redondeada a 1 decimal. */
  nota: number;
}

/**
 * Calcula la nota (0–10) de forma determinista. Fuente única usada tanto en el
 * servidor (al guardar la candidatura) como en la UI (para previsualizar).
 * - total = nº de preguntas del cuestionario.
 * - acierto = la opción elegida tiene `correcta: true`.
 */
export function calcularNotaCuestionario(
  preguntas: PreguntaCuestionario[],
  respuestas: RespuestasCuestionario,
): ResultadoCuestionario {
  const total = preguntas.length;
  if (total === 0) return { aciertos: 0, total: 0, nota: 0 };

  let aciertos = 0;
  for (const p of preguntas) {
    const opcionElegidaId = respuestas[p.id];
    if (!opcionElegidaId) continue;
    const opcion = p.opciones.find((o) => o.id === opcionElegidaId);
    if (opcion?.correcta) aciertos++;
  }

  const nota = Math.round((aciertos / total) * 10 * 10) / 10;
  return { aciertos, total, nota };
}

/** Genera un id corto estable para preguntas/opciones nuevas en el constructor. */
export function nuevoId(prefijo: "p" | "o"): string {
  return `${prefijo}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Crea una pregunta vacía con 3 opciones (la 1ª marcada como correcta). */
export function preguntaVacia(): PreguntaCuestionario {
  return {
    id: nuevoId("p"),
    titulo: "",
    tipo: "eleccion_multiple",
    obligatoria: true,
    opciones: [
      { id: nuevoId("o"), texto: "", correcta: true },
      { id: nuevoId("o"), texto: "", correcta: false },
      { id: nuevoId("o"), texto: "", correcta: false },
    ],
  };
}
