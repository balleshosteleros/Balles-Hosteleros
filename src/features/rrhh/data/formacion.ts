// ─── Formación (Training Data Layer) ─────────────────────────────

export interface ModuloFormativo {
  id: string;
  nombre: string;
  orden: number;
  videos: VideoFormativo[];
  evaluacion: Evaluacion;
}

export interface VideoFormativo {
  id: string;
  titulo: string;
  duracionMin: number;
  tipo: "generico" | "especifico";
  url: string;
}

export interface PreguntaEvaluacion {
  id: string;
  pregunta: string;
  opciones: string[];
  respuestaCorrecta: number;
}

export interface Evaluacion {
  id: string;
  nombre: string;
  preguntas: PreguntaEvaluacion[];
  notaMinima: number; // 0-100
}

export interface RutaFormativa {
  id: string;
  puestoId: string;
  puestoNombre: string;
  empresaId: string;
  modulos: ModuloFormativo[];
}

export interface ProgresoEmpleado {
  id: string;
  empleadoId: string;
  empleadoNombre: string;
  puestoNombre: string;
  empresaId: string;
  rutaId: string;
  modulosCompletados: number;
  totalModulos: number;
  videosVistos: number;
  totalVideos: number;
  evaluacionesAprobadas: number;
  evaluacionesSuspendidas: number;
  notaMedia: number;
  porcentajeAvance: number;
  estado: "en_curso" | "completado" | "bloqueado";
  ultimoAcceso: string;
  fechaInicio: string;
}

// ─── Mock: Rutas formativas por empresa ─────────────────────────

function crearEvaluacion(id: string, nombre: string, numPreguntas: number, notaMinima: number): Evaluacion {
  const preguntas: PreguntaEvaluacion[] = Array.from({ length: numPreguntas }, (_, i) => ({
    id: `${id}-p${i + 1}`,
    pregunta: `Pregunta ${i + 1} del módulo ${nombre}`,
    opciones: ["Opción A", "Opción B", "Opción C", "Opción D"],
    respuestaCorrecta: Math.floor(Math.random() * 4),
  }));
  return { id, nombre: `Evaluación: ${nombre}`, preguntas, notaMinima };
}

function crearModulo(id: string, nombre: string, orden: number, numVideos: number, notaMinima: number): ModuloFormativo {
  const videos: VideoFormativo[] = Array.from({ length: numVideos }, (_, i) => ({
    id: `${id}-v${i + 1}`,
    titulo: `${nombre} — Vídeo ${i + 1}`,
    duracionMin: Math.floor(Math.random() * 10) + 3,
    tipo: i < 2 ? "generico" : "especifico",
    url: "#",
  }));
  return { id, nombre, orden, videos, evaluacion: crearEvaluacion(`eval-${id}`, nombre, 5, notaMinima) };
}

const rutasHabana: RutaFormativa[] = [
  {
    id: "ruta-h-camarero", puestoId: "rh1", puestoNombre: "CAMARERO", empresaId: "habana",
    modulos: [
      crearModulo("m-hc1", "Bienvenida y cultura de empresa", 1, 4, 70),
      crearModulo("m-hc2", "Protocolo de sala", 2, 5, 70),
      crearModulo("m-hc3", "Carta y alérgenos", 3, 3, 80),
      crearModulo("m-hc4", "Servicio de mesas", 4, 4, 70),
      crearModulo("m-hc5", "Atención al cliente VIP", 5, 3, 75),
    ],
  },
  {
    id: "ruta-h-jefesala", puestoId: "rh2", puestoNombre: "JEFE DE SALA", empresaId: "habana",
    modulos: [
      crearModulo("m-hjs1", "Bienvenida y cultura de empresa", 1, 4, 70),
      crearModulo("m-hjs2", "Gestión de equipos de sala", 2, 6, 75),
      crearModulo("m-hjs3", "Resolución de conflictos", 3, 4, 80),
      crearModulo("m-hjs4", "Control de caja y cierre", 4, 3, 80),
    ],
  },
  {
    id: "ruta-h-cachimbero", puestoId: "rh3", puestoNombre: "CACHIMBERO", empresaId: "habana",
    modulos: [
      crearModulo("m-hch1", "Bienvenida y cultura de empresa", 1, 4, 70),
      crearModulo("m-hch2", "Preparación de cachimbas", 2, 5, 75),
      crearModulo("m-hch3", "Normativa y seguridad", 3, 3, 85),
    ],
  },
  {
    id: "ruta-h-dj", puestoId: "rh4", puestoNombre: "ARTISTA / DJ", empresaId: "habana",
    modulos: [
      crearModulo("m-hdj1", "Bienvenida y cultura de empresa", 1, 4, 70),
      crearModulo("m-hdj2", "Equipos de sonido e iluminación", 2, 4, 70),
      crearModulo("m-hdj3", "Protocolo de escenario", 3, 3, 70),
    ],
  },
  {
    id: "ruta-h-mant", puestoId: "rh5", puestoNombre: "MANTENIMIENTO", empresaId: "habana",
    modulos: [
      crearModulo("m-hm1", "Bienvenida y cultura de empresa", 1, 4, 70),
      crearModulo("m-hm2", "Mantenimiento preventivo", 2, 5, 75),
      crearModulo("m-hm3", "Protocolos de seguridad", 3, 4, 80),
    ],
  },
];

const rutasBacanal: RutaFormativa[] = [
  {
    id: "ruta-b-gerente", puestoId: "rb1", puestoNombre: "GERENTE", empresaId: "bacanal",
    modulos: [
      crearModulo("m-bg1", "Bienvenida y cultura de empresa", 1, 4, 70),
      crearModulo("m-bg2", "Gestión de establecimiento", 2, 6, 80),
      crearModulo("m-bg3", "Liderazgo y RRHH", 3, 5, 75),
      crearModulo("m-bg4", "Control financiero", 4, 4, 80),
    ],
  },
  {
    id: "ruta-b-camarero", puestoId: "rb2", puestoNombre: "CAMARERO", empresaId: "bacanal",
    modulos: [
      crearModulo("m-bc1", "Bienvenida y cultura de empresa", 1, 4, 70),
      crearModulo("m-bc2", "Protocolo de sala VIP", 2, 5, 75),
      crearModulo("m-bc3", "Carta y bebidas premium", 3, 4, 80),
    ],
  },
  {
    id: "ruta-b-contable", puestoId: "rb3", puestoNombre: "CONTABLE", empresaId: "bacanal",
    modulos: [
      crearModulo("m-bco1", "Bienvenida y cultura de empresa", 1, 4, 70),
      crearModulo("m-bco2", "Sistemas contables internos", 2, 5, 75),
      crearModulo("m-bco3", "Fiscalidad hostelera", 3, 4, 80),
    ],
  },
];

// ─── Mock: Progreso de empleados ────────────────────────────────

const progresoHabana: ProgresoEmpleado[] = [
  { id: "pf-h1", empleadoId: "h6", empleadoNombre: "Ana López Díaz", puestoNombre: "CAMARERO", empresaId: "habana", rutaId: "ruta-h-camarero", modulosCompletados: 3, totalModulos: 5, videosVistos: 12, totalVideos: 19, evaluacionesAprobadas: 3, evaluacionesSuspendidas: 0, notaMedia: 82, porcentajeAvance: 60, estado: "en_curso", ultimoAcceso: "2026-04-07 09:15", fechaInicio: "2026-03-15" },
  { id: "pf-h2", empleadoId: "h1", empleadoNombre: "Carlos Martínez López", puestoNombre: "CAMARERO", empresaId: "habana", rutaId: "ruta-h-camarero", modulosCompletados: 5, totalModulos: 5, videosVistos: 19, totalVideos: 19, evaluacionesAprobadas: 5, evaluacionesSuspendidas: 1, notaMedia: 88, porcentajeAvance: 100, estado: "completado", ultimoAcceso: "2026-03-28 14:30", fechaInicio: "2026-02-01" },
  { id: "pf-h3", empleadoId: "h2", empleadoNombre: "María García Fernández", puestoNombre: "JEFE DE SALA", empresaId: "habana", rutaId: "ruta-h-jefesala", modulosCompletados: 4, totalModulos: 4, videosVistos: 17, totalVideos: 17, evaluacionesAprobadas: 4, evaluacionesSuspendidas: 0, notaMedia: 91, porcentajeAvance: 100, estado: "completado", ultimoAcceso: "2026-03-20 11:00", fechaInicio: "2026-01-10" },
  { id: "pf-h4", empleadoId: "h3", empleadoNombre: "Alejandro Ruiz Torres", puestoNombre: "CACHIMBERO", empresaId: "habana", rutaId: "ruta-h-cachimbero", modulosCompletados: 1, totalModulos: 3, videosVistos: 4, totalVideos: 12, evaluacionesAprobadas: 1, evaluacionesSuspendidas: 2, notaMedia: 58, porcentajeAvance: 33, estado: "bloqueado", ultimoAcceso: "2026-04-05 20:00", fechaInicio: "2026-03-20" },
  { id: "pf-h5", empleadoId: "h7", empleadoNombre: "Pablo Herrera Vega", puestoNombre: "ARTISTA / DJ", empresaId: "habana", rutaId: "ruta-h-dj", modulosCompletados: 2, totalModulos: 3, videosVistos: 8, totalVideos: 11, evaluacionesAprobadas: 2, evaluacionesSuspendidas: 0, notaMedia: 76, porcentajeAvance: 67, estado: "en_curso", ultimoAcceso: "2026-04-06 22:00", fechaInicio: "2026-03-01" },
  { id: "pf-h6", empleadoId: "h8", empleadoNombre: "Sofía Romero Castillo", puestoNombre: "CAMARERO", empresaId: "habana", rutaId: "ruta-h-camarero", modulosCompletados: 1, totalModulos: 5, videosVistos: 4, totalVideos: 19, evaluacionesAprobadas: 1, evaluacionesSuspendidas: 0, notaMedia: 74, porcentajeAvance: 20, estado: "en_curso", ultimoAcceso: "2026-04-07 08:00", fechaInicio: "2026-04-01" },
];

const progresoBacanal: ProgresoEmpleado[] = [
  { id: "pf-b1", empleadoId: "b1", empleadoNombre: "Andrés Jiménez Ramos", puestoNombre: "GERENTE", empresaId: "bacanal", rutaId: "ruta-b-gerente", modulosCompletados: 4, totalModulos: 4, videosVistos: 19, totalVideos: 19, evaluacionesAprobadas: 4, evaluacionesSuspendidas: 0, notaMedia: 93, porcentajeAvance: 100, estado: "completado", ultimoAcceso: "2026-03-10 10:00", fechaInicio: "2026-01-15" },
  { id: "pf-b2", empleadoId: "b2", empleadoNombre: "Lucía Pérez Ortega", puestoNombre: "CAMARERO", empresaId: "bacanal", rutaId: "ruta-b-camarero", modulosCompletados: 2, totalModulos: 3, videosVistos: 9, totalVideos: 13, evaluacionesAprobadas: 2, evaluacionesSuspendidas: 1, notaMedia: 72, porcentajeAvance: 67, estado: "en_curso", ultimoAcceso: "2026-04-06 18:00", fechaInicio: "2026-03-01" },
  { id: "pf-b3", empleadoId: "b6", empleadoNombre: "Isabel Domínguez Lara", puestoNombre: "CONTABLE", empresaId: "bacanal", rutaId: "ruta-b-contable", modulosCompletados: 1, totalModulos: 3, videosVistos: 4, totalVideos: 13, evaluacionesAprobadas: 1, evaluacionesSuspendidas: 0, notaMedia: 78, porcentajeAvance: 33, estado: "en_curso", ultimoAcceso: "2026-04-07 09:00", fechaInicio: "2026-03-25" },
];

// ─── Estadísticas mensuales mock ────────────────────────────────

export interface EstadisticaMensual {
  mes: string;
  empleadosFormados: number;
  notaMedia: number;
  evaluacionesRealizadas: number;
}

const statsHabana: EstadisticaMensual[] = [
  { mes: "Nov 2025", empleadosFormados: 1, notaMedia: 72, evaluacionesRealizadas: 3 },
  { mes: "Dic 2025", empleadosFormados: 2, notaMedia: 78, evaluacionesRealizadas: 6 },
  { mes: "Ene 2026", empleadosFormados: 3, notaMedia: 80, evaluacionesRealizadas: 9 },
  { mes: "Feb 2026", empleadosFormados: 4, notaMedia: 83, evaluacionesRealizadas: 14 },
  { mes: "Mar 2026", empleadosFormados: 5, notaMedia: 81, evaluacionesRealizadas: 18 },
  { mes: "Abr 2026", empleadosFormados: 6, notaMedia: 79, evaluacionesRealizadas: 22 },
];

const statsBacanal: EstadisticaMensual[] = [
  { mes: "Nov 2025", empleadosFormados: 0, notaMedia: 0, evaluacionesRealizadas: 0 },
  { mes: "Dic 2025", empleadosFormados: 1, notaMedia: 85, evaluacionesRealizadas: 2 },
  { mes: "Ene 2026", empleadosFormados: 1, notaMedia: 90, evaluacionesRealizadas: 4 },
  { mes: "Feb 2026", empleadosFormados: 2, notaMedia: 88, evaluacionesRealizadas: 5 },
  { mes: "Mar 2026", empleadosFormados: 3, notaMedia: 82, evaluacionesRealizadas: 7 },
  { mes: "Abr 2026", empleadosFormados: 3, notaMedia: 81, evaluacionesRealizadas: 8 },
];

// ─── Public API ─────────────────────────────────────────────────

export function getRutasPorEmpresa(empresaId: string): RutaFormativa[] {
  if (empresaId === "habana") return rutasHabana;
  if (empresaId === "bacanal") return rutasBacanal;
  return [];
}

export function getProgresoPorEmpresa(empresaId: string): ProgresoEmpleado[] {
  if (empresaId === "habana") return [...progresoHabana];
  if (empresaId === "bacanal") return [...progresoBacanal];
  return [];
}

export function getEstadisticasMensuales(empresaId: string): EstadisticaMensual[] {
  if (empresaId === "habana") return statsHabana;
  if (empresaId === "bacanal") return statsBacanal;
  return [];
}

export function getResumenFormacion(empresaId: string) {
  const progresos = getProgresoPorEmpresa(empresaId);
  const rutas = getRutasPorEmpresa(empresaId);

  const enCurso = progresos.filter(p => p.estado === "en_curso").length;
  const completados = progresos.filter(p => p.estado === "completado").length;
  const bloqueados = progresos.filter(p => p.estado === "bloqueado").length;
  const totalEvaluaciones = progresos.reduce((s, p) => s + p.evaluacionesAprobadas + p.evaluacionesSuspendidas, 0);
  const aprobadas = progresos.reduce((s, p) => s + p.evaluacionesAprobadas, 0);
  const suspendidas = progresos.reduce((s, p) => s + p.evaluacionesSuspendidas, 0);
  const notaMedia = progresos.length > 0 ? Math.round(progresos.reduce((s, p) => s + p.notaMedia, 0) / progresos.length) : 0;
  const totalVideos = rutas.reduce((s, r) => s + r.modulos.reduce((s2, m) => s2 + m.videos.length, 0), 0);
  const videosGenericos = rutas.reduce((s, r) => s + r.modulos.reduce((s2, m) => s2 + m.videos.filter(v => v.tipo === "generico").length, 0), 0);
  const videosEspecificos = totalVideos - videosGenericos;
  const avanceMedio = progresos.length > 0 ? Math.round(progresos.reduce((s, p) => s + p.porcentajeAvance, 0) / progresos.length) : 0;

  // Per puesto
  const puestos = [...new Set(progresos.map(p => p.puestoNombre))];
  const porPuesto = puestos.map(puesto => {
    const ps = progresos.filter(p => p.puestoNombre === puesto);
    const ruta = rutas.find(r => r.puestoNombre === puesto);
    return {
      puesto,
      enFormacion: ps.filter(p => p.estado === "en_curso").length,
      completados: ps.filter(p => p.estado === "completado").length,
      bloqueados: ps.filter(p => p.estado === "bloqueado").length,
      notaMedia: ps.length > 0 ? Math.round(ps.reduce((s, p) => s + p.notaMedia, 0) / ps.length) : 0,
      avanceMedio: ps.length > 0 ? Math.round(ps.reduce((s, p) => s + p.porcentajeAvance, 0) / ps.length) : 0,
      videosPuesto: ruta ? ruta.modulos.reduce((s, m) => s + m.videos.length, 0) : 0,
      finalizacion: ps.length > 0 ? Math.round((ps.filter(p => p.estado === "completado").length / ps.length) * 100) : 0,
    };
  });

  return {
    totalPersonas: progresos.length,
    enCurso,
    completados,
    bloqueados,
    totalEvaluaciones,
    aprobadas,
    suspendidas,
    tasaAprobado: totalEvaluaciones > 0 ? Math.round((aprobadas / totalEvaluaciones) * 100) : 0,
    notaMedia,
    totalVideos,
    videosGenericos,
    videosEspecificos,
    avanceMedio,
    porPuesto,
    totalPuestos: rutas.length,
  };
}

export const PORTAL_FORMATIVO_URL = "/portal-formativo";
