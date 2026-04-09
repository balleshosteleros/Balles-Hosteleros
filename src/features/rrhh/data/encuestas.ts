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

// ─── Mock data ──────────────────────────────────────────────────

const encuestasHabana: Encuesta[] = [
  {
    id: "enc-h1",
    empresaId: "habana",
    nombre: "Clima laboral Q1 2026",
    descripcion: "Encuesta trimestral de clima laboral para todo el equipo.",
    estado: "activa",
    creadorId: "h4",
    creadorNombre: "Laura Sánchez",
    fechaCreacion: "2026-01-10",
    fechaCierre: "2026-04-30",
    anonima: true,
    unaRespuesta: true,
    modificarRespuesta: false,
    mensajeInicial: "Queremos conocer tu opinión para mejorar.",
    mensajeFinal: "¡Gracias por participar!",
    destinatarios: { tipo: "todos", ids: [] },
    grupos: [
      {
        id: "g1",
        titulo: "Ambiente de trabajo",
        descripcion: "Preguntas sobre el entorno laboral",
        preguntas: [
          { id: "p1", titulo: "¿Cómo valorarías el ambiente de trabajo?", tipo: "valoracion", obligatoria: true, opciones: [], puntuacion: true },
          { id: "p2", titulo: "¿Te sientes valorado/a por tu responsable?", tipo: "si_no", obligatoria: true, opciones: [], puntuacion: false },
          { id: "p3", titulo: "¿Qué mejorarías del ambiente de trabajo?", tipo: "texto", obligatoria: false, opciones: [], puntuacion: false },
        ],
      },
      {
        id: "g2",
        titulo: "Comunicación interna",
        descripcion: "Evalúa la comunicación dentro del equipo",
        preguntas: [
          {
            id: "p4", titulo: "¿Cómo calificarías la comunicación con tu equipo?", tipo: "unica", obligatoria: true, puntuacion: false,
            opciones: [
              { id: "o1", texto: "Excelente", color: "#22c55e" },
              { id: "o2", texto: "Buena", color: "#3b82f6" },
              { id: "o3", texto: "Regular", color: "#f59e0b" },
              { id: "o4", texto: "Mala", color: "#ef4444" },
            ],
          },
          { id: "p5", titulo: "¿Recibes feedback suficiente de tu responsable?", tipo: "escala", obligatoria: true, opciones: [], puntuacion: true },
        ],
      },
    ],
    respuestas: [
      { empleadoId: "h1", fecha: "2026-03-15", respuestas: { p1: 4, p2: "si", p3: "Más reuniones de equipo", p4: "o2", p5: 7 } },
      { empleadoId: "h2", fecha: "2026-03-16", respuestas: { p1: 5, p2: "si", p3: "", p4: "o1", p5: 9 } },
      { empleadoId: "h6", fecha: "2026-03-17", respuestas: { p1: 3, p2: "no", p3: "Mejor organización de turnos", p4: "o3", p5: 5 } },
      { empleadoId: "h8", fecha: "2026-03-18", respuestas: { p1: 4, p2: "si", p3: "", p4: "o2", p5: 8 } },
    ],
  },
  {
    id: "enc-h2",
    empresaId: "habana",
    nombre: "Satisfacción con uniformes",
    descripcion: "Encuesta rápida sobre conformidad con los nuevos uniformes.",
    estado: "finalizada",
    creadorId: "h5",
    creadorNombre: "Pedro Ruiz",
    fechaCreacion: "2026-02-01",
    fechaCierre: "2026-03-01",
    anonima: false,
    unaRespuesta: true,
    modificarRespuesta: true,
    mensajeInicial: "Danos tu opinión sobre los uniformes.",
    mensajeFinal: "Gracias.",
    destinatarios: { tipo: "departamentos", ids: ["CAMAREROS", "JEFE DE SALA"] },
    grupos: [
      {
        id: "g3",
        titulo: "Uniformes",
        descripcion: "",
        preguntas: [
          {
            id: "p6", titulo: "¿Estás conforme con el nuevo uniforme?", tipo: "si_no", obligatoria: true, opciones: [], puntuacion: false,
          },
          {
            id: "p7", titulo: "¿Qué prenda mejorarías?", tipo: "multiple", obligatoria: false, puntuacion: false,
            opciones: [
              { id: "o5", texto: "Camiseta", color: "#3b82f6" },
              { id: "o6", texto: "Pantalón", color: "#8b5cf6" },
              { id: "o7", texto: "Calzado", color: "#f59e0b" },
              { id: "o8", texto: "Delantal", color: "#ef4444" },
            ],
          },
        ],
      },
    ],
    respuestas: [
      { empleadoId: "h2", fecha: "2026-02-10", respuestas: { p6: "si", p7: ["o7"] } },
      { empleadoId: "h6", fecha: "2026-02-12", respuestas: { p6: "no", p7: ["o5", "o7"] } },
      { empleadoId: "h10", fecha: "2026-02-14", respuestas: { p6: "si", p7: [] } },
    ],
  },
  {
    id: "enc-h3",
    empresaId: "habana",
    nombre: "Bonus compañerismo",
    descripcion: "Encuesta para evaluar el compañerismo y detectar dinámicas de equipo.",
    estado: "borrador",
    creadorId: "h4",
    creadorNombre: "Laura Sánchez",
    fechaCreacion: "2026-04-01",
    fechaCierre: "",
    anonima: true,
    unaRespuesta: true,
    modificarRespuesta: false,
    mensajeInicial: "",
    mensajeFinal: "",
    destinatarios: { tipo: "todos", ids: [] },
    grupos: [],
    respuestas: [],
  },
];

const encuestasBacanal: Encuesta[] = [
  {
    id: "enc-b1",
    empresaId: "bacanal",
    nombre: "Evaluación de formación inicial",
    descripcion: "Valoración de la formación recibida en la incorporación.",
    estado: "activa",
    creadorId: "b1",
    creadorNombre: "Andrés Jiménez",
    fechaCreacion: "2026-02-15",
    fechaCierre: "2026-05-15",
    anonima: false,
    unaRespuesta: true,
    modificarRespuesta: false,
    mensajeInicial: "Tu opinión nos ayuda a mejorar la formación.",
    mensajeFinal: "Gracias por colaborar.",
    destinatarios: { tipo: "todos", ids: [] },
    grupos: [
      {
        id: "g4",
        titulo: "Formación",
        descripcion: "Evalúa tu experiencia de formación",
        preguntas: [
          { id: "p8", titulo: "¿La formación fue suficiente para tu puesto?", tipo: "si_no", obligatoria: true, opciones: [], puntuacion: false },
          { id: "p9", titulo: "Valora la calidad de la formación", tipo: "valoracion", obligatoria: true, opciones: [], puntuacion: true },
          { id: "p10", titulo: "¿Qué echarías en falta?", tipo: "texto", obligatoria: false, opciones: [], puntuacion: false },
        ],
      },
    ],
    respuestas: [
      { empleadoId: "b3", fecha: "2026-03-01", respuestas: { p8: "si", p9: 4, p10: "Más práctica real" } },
      { empleadoId: "b6", fecha: "2026-03-05", respuestas: { p8: "si", p9: 5, p10: "" } },
      { empleadoId: "b2", fecha: "2026-03-10", respuestas: { p8: "no", p9: 3, p10: "Manual de procesos" } },
    ],
  },
];

// ─── Public API ─────────────────────────────────────────────────
export function getEncuestasPorEmpresa(empresaId: string): Encuesta[] {
  if (empresaId === "habana") return encuestasHabana;
  if (empresaId === "bacanal") return encuestasBacanal;
  return [];
}

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
