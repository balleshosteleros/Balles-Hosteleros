// ─── Encuestas internas ─────────────────────────────────────────

export type EstadoEncuesta = "borrador" | "activa" | "finalizada" | "archivada";
export type TipoPregunta = "unica" | "multiple" | "texto" | "valoracion" | "escala" | "si_no";

export const ESTADO_ENCUESTA_LABEL: Record<EstadoEncuesta, string> = {
  borrador: "Borrador",
  activa: "Activa",
  finalizada: "Finalizada",
  archivada: "Archivada",
};

export const ESTADO_ENCUESTA_COLOR: Record<EstadoEncuesta, string> = {
  borrador: "bg-muted-foreground/60 text-white",
  activa: "bg-emerald-500 text-white",
  finalizada: "bg-blue-500 text-white",
  archivada: "bg-amber-500 text-white",
};

export const TIPO_PREGUNTA_LABEL: Record<TipoPregunta, string> = {
  unica: "Respuesta única",
  multiple: "Respuesta múltiple",
  texto: "Texto libre",
  valoracion: "Valoración (1-5)",
  escala: "Escala (1-10)",
  si_no: "Sí / No",
};

export interface OpcionRespuesta {
  id: string;
  texto: string;
  color: string;
}

export interface PreguntaEncuesta {
  id: string;
  titulo: string;
  tipo: TipoPregunta;
  obligatoria: boolean;
  opciones: OpcionRespuesta[];
  puntuacion: boolean;
}

export interface GrupoPreguntas {
  id: string;
  titulo: string;
  descripcion: string;
  preguntas: PreguntaEncuesta[];
}

export interface RespuestaEmpleado {
  empleadoId: string;
  fecha: string;
  respuestas: Record<string, string | string[] | number>; // preguntaId → value
}

export interface Encuesta {
  id: string;
  empresaId: string;
  nombre: string;
  descripcion: string;
  estado: EstadoEncuesta;
  creadorId: string;
  creadorNombre: string;
  fechaCreacion: string;
  fechaCierre: string;
  anonima: boolean;
  unaRespuesta: boolean;
  modificarRespuesta: boolean;
  mensajeInicial: string;
  mensajeFinal: string;
  destinatarios: { tipo: "todos" | "roles" | "departamentos" | "empleados"; ids: string[] };
  grupos: GrupoPreguntas[];
  respuestas: RespuestaEmpleado[];
}

// ─── Colores para opciones ──────────────────────────────────────
export const COLORES_OPCIONES = [
  "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316",
];

// ─── Fábrica ────────────────────────────────────────────────────
export function crearEncuestaVacia(empresaId: string, creadorId: string, creadorNombre: string): Encuesta {
  return {
    id: `enc-${Date.now()}`,
    empresaId,
    nombre: "",
    descripcion: "",
    estado: "borrador",
    creadorId,
    creadorNombre,
    fechaCreacion: new Date().toISOString().slice(0, 10),
    fechaCierre: "",
    anonima: false,
    unaRespuesta: true,
    modificarRespuesta: false,
    mensajeInicial: "",
    mensajeFinal: "",
    destinatarios: { tipo: "todos", ids: [] },
    grupos: [],
    respuestas: [],
  };
}
