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

// ─── Mock data ──────────────────────────────────────────────────

const cuestionariosHabana: Cuestionario[] = [
  {
    id: "cue-h1",
    empresaId: "habana",
    nombre: "Test APPCC — Manipulación de alimentos",
    descripcion: "Evaluación obligatoria sobre normas de seguridad alimentaria y APPCC.",
    categoria: "conocimiento",
    estado: "activo",
    creadorId: "h4",
    creadorNombre: "Laura Sánchez",
    fechaCreacion: "2026-02-10",
    fechaCierre: "2026-06-30",
    duracionMinutos: 20,
    intentosMax: 2,
    notaCorte: 70,
    mostrarResultados: true,
    aleatorizarPreguntas: false,
    mensajeInicial: "Tienes 20 minutos. Necesitas 70% para aprobar.",
    mensajeAprobado: "¡Has aprobado! Tu certificado APPCC está disponible.",
    mensajeNoAprobado: "No has alcanzado la nota de corte. Revisa el material y vuelve a intentarlo.",
    destinatarios: { tipo: "todos", ids: [] },
    bloques: [
      {
        id: "b1",
        titulo: "Higiene y manipulación",
        descripcion: "Normas básicas de higiene en cocina",
        preguntas: [
          {
            id: "p1",
            titulo: "¿A qué temperatura debe conservarse el pescado fresco?",
            tipo: "unica",
            obligatoria: true,
            puntos: 10,
            respuestaTexto: "",
            explicacion: "El pescado fresco debe conservarse entre 0 y 2°C.",
            opciones: [
              { id: "o1", texto: "Entre 0 y 2°C", correcta: true },
              { id: "o2", texto: "Entre 4 y 6°C", correcta: false },
              { id: "o3", texto: "Entre 8 y 10°C", correcta: false },
              { id: "o4", texto: "A temperatura ambiente", correcta: false },
            ],
          },
          {
            id: "p2",
            titulo: "¿Es obligatorio lavarse las manos al cambiar de tarea?",
            tipo: "verdadero_falso",
            obligatoria: true,
            puntos: 10,
            respuestaTexto: "",
            explicacion: "Sí, es obligatorio para evitar la contaminación cruzada.",
            opciones: [
              { id: "o5", texto: "Verdadero", correcta: true },
              { id: "o6", texto: "Falso", correcta: false },
            ],
          },
          {
            id: "p3",
            titulo: "Marca todas las prácticas correctas en cocina:",
            tipo: "multiple",
            obligatoria: true,
            puntos: 15,
            respuestaTexto: "",
            explicacion: "Todas las opciones excepto la última son correctas.",
            opciones: [
              { id: "o7", texto: "Separar tablas de corte por tipo de alimento", correcta: true },
              { id: "o8", texto: "Lavar verduras antes de preparar", correcta: true },
              { id: "o9", texto: "Usar guantes para alimentos listos para consumo", correcta: true },
              { id: "o10", texto: "Probar comida con el dedo", correcta: false },
            ],
          },
        ],
      },
      {
        id: "b2",
        titulo: "Control de temperaturas",
        descripcion: "Cadena de frío y conservación",
        preguntas: [
          {
            id: "p4",
            titulo: "¿Cuál es la zona de peligro de temperatura?",
            tipo: "unica",
            obligatoria: true,
            puntos: 15,
            respuestaTexto: "",
            explicacion: "Entre 5°C y 60°C los microorganismos proliferan rápidamente.",
            opciones: [
              { id: "o11", texto: "Entre -5°C y 0°C", correcta: false },
              { id: "o12", texto: "Entre 5°C y 60°C", correcta: true },
              { id: "o13", texto: "Entre 60°C y 80°C", correcta: false },
              { id: "o14", texto: "Por encima de 100°C", correcta: false },
            ],
          },
        ],
      },
    ],
    respuestas: [
      {
        empleadoId: "h1",
        fecha: "2026-03-05",
        respuestas: { p1: "o1", p2: "o5", p3: ["o7", "o8", "o9"], p4: "o12" },
        puntuacion: 50,
        notaSobre: 50,
        aprobado: true,
        intento: 1,
        duracionMin: 12,
      },
      {
        empleadoId: "h2",
        fecha: "2026-03-06",
        respuestas: { p1: "o1", p2: "o5", p3: ["o7", "o8"], p4: "o12" },
        puntuacion: 35,
        notaSobre: 50,
        aprobado: true,
        intento: 1,
        duracionMin: 15,
      },
      {
        empleadoId: "h6",
        fecha: "2026-03-07",
        respuestas: { p1: "o2", p2: "o5", p3: ["o7"], p4: "o11" },
        puntuacion: 15,
        notaSobre: 50,
        aprobado: false,
        intento: 1,
        duracionMin: 18,
      },
    ],
  },
  {
    id: "cue-h2",
    empresaId: "habana",
    nombre: "Evaluación inicial — Camareros",
    descripcion: "Cuestionario de inducción para nuevas incorporaciones del equipo de sala.",
    categoria: "induccion",
    estado: "activo",
    creadorId: "h4",
    creadorNombre: "Laura Sánchez",
    fechaCreacion: "2026-01-20",
    fechaCierre: "",
    duracionMinutos: 15,
    intentosMax: 3,
    notaCorte: 60,
    mostrarResultados: true,
    aleatorizarPreguntas: true,
    mensajeInicial: "Bienvenido/a al equipo. Esta evaluación valida tu formación inicial.",
    mensajeAprobado: "¡Enhorabuena! Estás listo/a para empezar.",
    mensajeNoAprobado: "Repasa el manual de bienvenida y vuelve a intentarlo.",
    destinatarios: { tipo: "departamentos", ids: ["CAMAREROS"] },
    bloques: [
      {
        id: "b3",
        titulo: "Procedimientos de sala",
        descripcion: "",
        preguntas: [
          {
            id: "p5",
            titulo: "¿Cuántos minutos puede esperar un cliente sin atención antes de avisar al jefe de sala?",
            tipo: "unica",
            obligatoria: true,
            puntos: 20,
            respuestaTexto: "",
            explicacion: "Estándar interno: máximo 3 minutos.",
            opciones: [
              { id: "o15", texto: "1 minuto", correcta: false },
              { id: "o16", texto: "3 minutos", correcta: true },
              { id: "o17", texto: "5 minutos", correcta: false },
              { id: "o18", texto: "10 minutos", correcta: false },
            ],
          },
          {
            id: "p6",
            titulo: "Describe brevemente el protocolo de bienvenida.",
            tipo: "texto",
            obligatoria: false,
            puntos: 10,
            respuestaTexto: "Saludar, ofrecer carta y recomendación del día.",
            explicacion: "Saludo en menos de 30s, carta y recomendación.",
            opciones: [],
          },
        ],
      },
    ],
    respuestas: [
      {
        empleadoId: "h8",
        fecha: "2026-02-15",
        respuestas: { p5: "o16", p6: "Saludar y entregar carta" },
        puntuacion: 25,
        notaSobre: 30,
        aprobado: true,
        intento: 1,
        duracionMin: 8,
      },
    ],
  },
  {
    id: "cue-h3",
    empresaId: "habana",
    nombre: "Evaluación trimestral 360°",
    descripcion: "Evaluación de desempeño para responsables de área.",
    categoria: "evaluacion",
    estado: "borrador",
    creadorId: "h4",
    creadorNombre: "Laura Sánchez",
    fechaCreacion: "2026-04-10",
    fechaCierre: "",
    duracionMinutos: 30,
    intentosMax: 1,
    notaCorte: 0,
    mostrarResultados: false,
    aleatorizarPreguntas: false,
    mensajeInicial: "",
    mensajeAprobado: "",
    mensajeNoAprobado: "",
    destinatarios: { tipo: "todos", ids: [] },
    bloques: [],
    respuestas: [],
  },
];

const cuestionariosBacanal: Cuestionario[] = [
  {
    id: "cue-b1",
    empresaId: "bacanal",
    nombre: "Test de carta y maridajes",
    descripcion: "Evaluación de conocimientos sobre la carta actual y recomendaciones de vinos.",
    categoria: "conocimiento",
    estado: "activo",
    creadorId: "b1",
    creadorNombre: "Andrés Jiménez",
    fechaCreacion: "2026-03-01",
    fechaCierre: "2026-05-30",
    duracionMinutos: 25,
    intentosMax: 2,
    notaCorte: 75,
    mostrarResultados: true,
    aleatorizarPreguntas: true,
    mensajeInicial: "Demuestra que conoces la carta de temporada.",
    mensajeAprobado: "Excelente, ya puedes recomendar a los clientes.",
    mensajeNoAprobado: "Repasa la carta y los maridajes sugeridos.",
    destinatarios: { tipo: "departamentos", ids: ["CAMAREROS", "JEFE DE SALA"] },
    bloques: [
      {
        id: "b4",
        titulo: "Carta",
        descripcion: "",
        preguntas: [
          {
            id: "p7",
            titulo: "¿Qué vino se recomienda con el solomillo de ternera?",
            tipo: "unica",
            obligatoria: true,
            puntos: 20,
            respuestaTexto: "",
            explicacion: "El Ribera del Duero crianza es la recomendación oficial.",
            opciones: [
              { id: "o19", texto: "Albariño", correcta: false },
              { id: "o20", texto: "Ribera del Duero crianza", correcta: true },
              { id: "o21", texto: "Cava brut nature", correcta: false },
            ],
          },
        ],
      },
    ],
    respuestas: [],
  },
];

// ─── Public API ─────────────────────────────────────────────────
export function getCuestionariosPorEmpresa(empresaId: string): Cuestionario[] {
  if (empresaId === "habana") return cuestionariosHabana;
  if (empresaId === "bacanal") return cuestionariosBacanal;
  return [];
}

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

export function getCuestionariosAsignadosAEmpleado(
  empresaId: string,
  empleadoId: string,
  departamentoEmpleado: string | null,
): Cuestionario[] {
  return getCuestionariosPorEmpresa(empresaId).filter((c) => {
    if (c.estado !== "activo") return false;
    const d = c.destinatarios;
    if (d.tipo === "todos") return true;
    if (d.tipo === "empleados") return d.ids.includes(empleadoId);
    if (d.tipo === "departamentos")
      return departamentoEmpleado ? d.ids.includes(departamentoEmpleado) : false;
    return false;
  });
}
