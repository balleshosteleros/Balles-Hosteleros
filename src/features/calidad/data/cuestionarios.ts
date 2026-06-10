// ─── Cuestionarios (evaluaciones con respuestas correctas) ──────

export type EstadoCuestionario = "borrador" | "activo" | "finalizado" | "archivado";
export type CategoriaCuestionario = "evaluacion" | "formacion" | "conocimiento" | "induccion";
export type TipoPreguntaCuestionario = "unica" | "multiple" | "verdadero_falso" | "texto";

export const ESTADO_CUESTIONARIO_LABEL: Record<EstadoCuestionario, string> = {
  borrador: "Borrador",
  activo: "Activo",
  finalizado: "Finalizado",
  archivado: "Archivado",
};

export const ESTADO_CUESTIONARIO_COLOR: Record<EstadoCuestionario, string> = {
  borrador: "bg-muted-foreground/60 text-white",
  activo: "bg-emerald-500 text-white",
  finalizado: "bg-blue-500 text-white",
  archivado: "bg-amber-500 text-white",
};

export const CATEGORIA_CUESTIONARIO_LABEL: Record<CategoriaCuestionario, string> = {
  evaluacion: "Evaluación de desempeño",
  formacion: "Test de formación",
  conocimiento: "Test de conocimientos",
  induccion: "Inducción / Onboarding",
};

export const TIPO_PREGUNTA_CUESTIONARIO_LABEL: Record<TipoPreguntaCuestionario, string> = {
  unica: "Respuesta única",
  multiple: "Respuesta múltiple",
  verdadero_falso: "Verdadero / Falso",
  texto: "Texto libre",
};

export interface OpcionCuestionario {
  id: string;
  texto: string;
  correcta: boolean;
}

export interface PreguntaCuestionario {
  id: string;
  titulo: string;
  tipo: TipoPreguntaCuestionario;
  obligatoria: boolean;
  puntos: number;
  opciones: OpcionCuestionario[];
  respuestaTexto: string;
  explicacion: string;
}

export interface BloqueCuestionario {
  id: string;
  titulo: string;
  descripcion: string;
  preguntas: PreguntaCuestionario[];
}

export interface RespuestaEmpleadoCuestionario {
  empleadoId: string;
  fecha: string;
  respuestas: Record<string, string | string[]>;
  puntuacion: number;
  notaSobre: number;
  aprobado: boolean;
  intento: number;
  duracionMin: number;
}

export interface Cuestionario {
  id: string;
  empresaId: string;
  nombre: string;
  descripcion: string;
  categoria: CategoriaCuestionario;
  estado: EstadoCuestionario;
  creadorId: string;
  creadorNombre: string;
  fechaCreacion: string;
  fechaCierre: string;
  duracionMinutos: number;
  intentosMax: number;
  notaCorte: number;
  mostrarResultados: boolean;
  aleatorizarPreguntas: boolean;
  mensajeInicial: string;
  mensajeAprobado: string;
  mensajeNoAprobado: string;
  destinatarios: { tipo: "todos" | "roles" | "departamentos" | "empleados"; ids: string[] };
  bloques: BloqueCuestionario[];
  respuestas: RespuestaEmpleadoCuestionario[];
}

// ─── Fábrica / helpers ─────────────────────────────────────────
export function crearCuestionarioVacio(
  empresaId: string,
  creadorId: string,
  creadorNombre: string,
): Cuestionario {
  return {
    id: `cue-${Date.now()}`,
    empresaId,
    nombre: "",
    descripcion: "",
    categoria: "conocimiento",
    estado: "borrador",
    creadorId,
    creadorNombre,
    fechaCreacion: new Date().toISOString().slice(0, 10),
    fechaCierre: "",
    duracionMinutos: 15,
    intentosMax: 1,
    notaCorte: 70,
    mostrarResultados: true,
    aleatorizarPreguntas: false,
    mensajeInicial: "",
    mensajeAprobado: "",
    mensajeNoAprobado: "",
    destinatarios: { tipo: "todos", ids: [] },
    bloques: [],
    respuestas: [],
  };
}

export function calcularPuntuacionMaxima(c: Cuestionario): number {
  return c.bloques.reduce(
    (sum, b) => sum + b.preguntas.reduce((s, p) => s + p.puntos, 0),
    0,
  );
}
