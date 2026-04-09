export interface TurnoLaboral {
  id: string;
  empleadoId: string;
  empleadoNombre: string;
  avatar?: string;
  departamento: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  horasPrevistas: number;
  color: string;
}

export interface Vacacion {
  id: string;
  empleadoId: string;
  empleadoNombre: string;
  departamento: string;
  fechaInicio: string;
  fechaFin: string;
  dias: number;
  estado: "aprobada" | "pendiente" | "rechazada";
  observaciones?: string;
}

export interface Festivo {
  id: string;
  fecha: string;
  nombre: string;
  tipo: "general" | "local";
  centro: string;
}

export interface BajaMedica {
  id: string;
  empleadoId: string;
  empleadoNombre: string;
  departamento: string;
  fechaInicio: string;
  fechaFin?: string;
  estado: "activa" | "finalizada" | "pendiente";
  motivo?: string;
  observaciones?: string;
}

export interface Justificada {
  id: string;
  empleadoId: string;
  empleadoNombre: string;
  departamento: string;
  fecha: string;
  fechaFin?: string;
  tipo: string;
  estado: "aprobada" | "pendiente" | "rechazada";
  observaciones?: string;
}

export interface ConfigCalendario {
  tiposSolicitud: string[];
  estados: string[];
  requiereAprobacion: boolean;
  requiereJustificante: boolean;
  observacionesObligatorias: boolean;
  duracionMaxDias?: number;
  duracionMinDias?: number;
  colorPrincipal: string;
  visibilidad: "todos" | "departamento" | "responsable";
}

const COLORES_TURNO = [
  "bg-sky-500/80", "bg-emerald-500/80", "bg-amber-500/80",
  "bg-violet-500/80", "bg-rose-500/80", "bg-teal-500/80",
];

const HABANA_TURNOS: TurnoLaboral[] = [
  { id: "th1", empleadoId: "h4", empleadoNombre: "Laura Sánchez Moreno", departamento: "DIRECCIÓN", fecha: "2026-04-06", horaInicio: "08:00", horaFin: "16:00", horasPrevistas: 8, color: COLORES_TURNO[0] },
  { id: "th2", empleadoId: "h2", empleadoNombre: "María García Fernández", departamento: "JEFE DE SALA", fecha: "2026-04-06", horaInicio: "10:00", horaFin: "18:00", horasPrevistas: 8, color: COLORES_TURNO[1] },
  { id: "th3", empleadoId: "h5", empleadoNombre: "Pedro Ruiz Navarro", departamento: "GERENTE", fecha: "2026-04-06", horaInicio: "09:00", horaFin: "15:00", horasPrevistas: 6, color: COLORES_TURNO[2] },
  { id: "th4", empleadoId: "h8", empleadoNombre: "Sofía Martín Herrero", departamento: "RRPP", fecha: "2026-04-06", horaInicio: "16:00", horaFin: "22:00", horasPrevistas: 6, color: COLORES_TURNO[3] },
  { id: "th5", empleadoId: "h6", empleadoNombre: "Ana López Díaz", departamento: "CAMAREROS", fecha: "2026-04-06", horaInicio: "17:00", horaFin: "22:00", horasPrevistas: 5, color: COLORES_TURNO[4] },
  { id: "th6", empleadoId: "h10", empleadoNombre: "Elena Vega Prieto", departamento: "CAMAREROS", fecha: "2026-04-06", horaInicio: "18:00", horaFin: "22:00", horasPrevistas: 4, color: COLORES_TURNO[5] },
  { id: "th7", empleadoId: "h3", empleadoNombre: "Alejandro Ruiz Torres", departamento: "ARTISTAS", fecha: "2026-04-06", horaInicio: "23:00", horaFin: "03:00", horasPrevistas: 4, color: COLORES_TURNO[0] },
  { id: "th8", empleadoId: "h4", empleadoNombre: "Laura Sánchez Moreno", departamento: "DIRECCIÓN", fecha: "2026-04-07", horaInicio: "08:00", horaFin: "16:00", horasPrevistas: 8, color: COLORES_TURNO[0] },
  { id: "th9", empleadoId: "h2", empleadoNombre: "María García Fernández", departamento: "JEFE DE SALA", fecha: "2026-04-07", horaInicio: "10:00", horaFin: "18:00", horasPrevistas: 8, color: COLORES_TURNO[1] },
  { id: "th10", empleadoId: "h8", empleadoNombre: "Sofía Martín Herrero", departamento: "RRPP", fecha: "2026-04-07", horaInicio: "16:00", horaFin: "22:00", horasPrevistas: 6, color: COLORES_TURNO[3] },
];

const BACANAL_TURNOS: TurnoLaboral[] = [
  { id: "tb1", empleadoId: "b1", empleadoNombre: "Andrés Jiménez Ramos", departamento: "DIRECCIÓN", fecha: "2026-04-06", horaInicio: "08:00", horaFin: "16:00", horasPrevistas: 8, color: COLORES_TURNO[0] },
  { id: "tb2", empleadoId: "b3", empleadoNombre: "Miguel Santos Gil", departamento: "CAMAREROS", fecha: "2026-04-06", horaInicio: "17:00", horaFin: "22:00", horasPrevistas: 5, color: COLORES_TURNO[1] },
  { id: "tb3", empleadoId: "b6", empleadoNombre: "Isabel Domínguez Lara", departamento: "ADMINISTRATIVO", fecha: "2026-04-06", horaInicio: "09:00", horaFin: "17:00", horasPrevistas: 8, color: COLORES_TURNO[2] },
  { id: "tb4", empleadoId: "b2", empleadoNombre: "Lucía Pérez Ortega", departamento: "JEFE DE SALA", fecha: "2026-04-06", horaInicio: "16:00", horaFin: "23:00", horasPrevistas: 7, color: COLORES_TURNO[3] },
  { id: "tb5", empleadoId: "b4", empleadoNombre: "Carmen Morales Reyes", departamento: "ARTISTAS", fecha: "2026-04-06", horaInicio: "22:00", horaFin: "02:00", horasPrevistas: 4, color: COLORES_TURNO[4] },
  { id: "tb6", empleadoId: "b5", empleadoNombre: "Raúl Herrera Muñoz", departamento: "COCINA", fecha: "2026-04-06", horaInicio: "12:00", horaFin: "20:00", horasPrevistas: 8, color: COLORES_TURNO[5] },
  { id: "tb7", empleadoId: "b1", empleadoNombre: "Andrés Jiménez Ramos", departamento: "DIRECCIÓN", fecha: "2026-04-07", horaInicio: "08:00", horaFin: "16:00", horasPrevistas: 8, color: COLORES_TURNO[0] },
];

const HABANA_VACACIONES: Vacacion[] = [
  { id: "vh1", empleadoId: "h7", empleadoNombre: "Javier Fernández Castro", departamento: "MANTENIMIENTO", fechaInicio: "2026-04-01", fechaFin: "2026-04-15", dias: 15, estado: "aprobada" },
  { id: "vh2", empleadoId: "h9", empleadoNombre: "Diego Romero Blanco", departamento: "CACHIMBEROS", fechaInicio: "2026-04-10", fechaFin: "2026-04-20", dias: 11, estado: "pendiente" },
  { id: "vh3", empleadoId: "h1", empleadoNombre: "Carlos Martínez López", departamento: "CACHIMBEROS", fechaInicio: "2026-05-01", fechaFin: "2026-05-14", dias: 14, estado: "aprobada" },
];

const BACANAL_VACACIONES: Vacacion[] = [
  { id: "vb1", empleadoId: "b8", empleadoNombre: "Marta Iglesias Peña", departamento: "RRPP", fechaInicio: "2026-04-03", fechaFin: "2026-04-17", dias: 15, estado: "aprobada" },
  { id: "vb2", empleadoId: "b5", empleadoNombre: "Raúl Herrera Muñoz", departamento: "COCINA", fechaInicio: "2026-04-20", fechaFin: "2026-04-30", dias: 11, estado: "pendiente" },
];

const HABANA_FESTIVOS: Festivo[] = [
  { id: "feh1", fecha: "2026-01-01", nombre: "Año Nuevo", tipo: "general", centro: "Habana" },
  { id: "feh2", fecha: "2026-01-06", nombre: "Reyes Magos", tipo: "general", centro: "Habana" },
  { id: "feh3", fecha: "2026-05-01", nombre: "Día del Trabajador", tipo: "general", centro: "Habana" },
  { id: "feh4", fecha: "2026-05-15", nombre: "San Isidro", tipo: "local", centro: "Habana" },
  { id: "feh5", fecha: "2026-08-15", nombre: "Asunción de la Virgen", tipo: "general", centro: "Habana" },
  { id: "feh6", fecha: "2026-10-12", nombre: "Fiesta Nacional", tipo: "general", centro: "Habana" },
  { id: "feh7", fecha: "2026-12-25", nombre: "Navidad", tipo: "general", centro: "Habana" },
];

const BACANAL_FESTIVOS: Festivo[] = [
  { id: "feb1", fecha: "2026-01-01", nombre: "Año Nuevo", tipo: "general", centro: "Bacanal" },
  { id: "feb2", fecha: "2026-01-06", nombre: "Reyes Magos", tipo: "general", centro: "Bacanal" },
  { id: "feb3", fecha: "2026-03-19", nombre: "Fallas", tipo: "local", centro: "Bacanal" },
  { id: "feb4", fecha: "2026-05-01", nombre: "Día del Trabajador", tipo: "general", centro: "Bacanal" },
  { id: "feb5", fecha: "2026-08-15", nombre: "Asunción de la Virgen", tipo: "general", centro: "Bacanal" },
  { id: "feb6", fecha: "2026-12-25", nombre: "Navidad", tipo: "general", centro: "Bacanal" },
];

const HABANA_BAJAS: BajaMedica[] = [
  { id: "bh1", empleadoId: "h1", empleadoNombre: "Carlos Martínez López", departamento: "CACHIMBEROS", fechaInicio: "2026-03-20", fechaFin: "2026-04-10", estado: "activa", motivo: "Lesión espalda" },
  { id: "bh2", empleadoId: "h6", empleadoNombre: "Ana López Díaz", departamento: "CAMAREROS", fechaInicio: "2026-02-01", fechaFin: "2026-02-15", estado: "finalizada", motivo: "Gripe" },
];

const BACANAL_BAJAS: BajaMedica[] = [
  { id: "bb1", empleadoId: "b4", empleadoNombre: "Carmen Morales Reyes", departamento: "ARTISTAS", fechaInicio: "2026-04-01", estado: "activa", motivo: "Intervención quirúrgica" },
];

const HABANA_JUSTIFICADAS: Justificada[] = [
  { id: "jh1", empleadoId: "h3", empleadoNombre: "Alejandro Ruiz Torres", departamento: "ARTISTAS", fecha: "2026-04-08", tipo: "Asunto personal", estado: "aprobada", observaciones: "Trámite administrativo" },
  { id: "jh2", empleadoId: "h10", empleadoNombre: "Elena Vega Prieto", departamento: "CAMAREROS", fecha: "2026-04-12", fechaFin: "2026-04-13", tipo: "Familiar", estado: "pendiente", observaciones: "Acompañamiento médico familiar" },
];

const BACANAL_JUSTIFICADAS: Justificada[] = [
  { id: "jb1", empleadoId: "b6", empleadoNombre: "Isabel Domínguez Lara", departamento: "ADMINISTRATIVO", fecha: "2026-04-09", tipo: "Formación", estado: "aprobada", observaciones: "Curso obligatorio PRL" },
];

export function getTurnosPorEmpresa(empresaId: string): TurnoLaboral[] {
  if (empresaId === "habana") return HABANA_TURNOS;
  if (empresaId === "bacanal") return BACANAL_TURNOS;
  return [];
}

export function getVacacionesPorEmpresa(empresaId: string): Vacacion[] {
  if (empresaId === "habana") return HABANA_VACACIONES;
  if (empresaId === "bacanal") return BACANAL_VACACIONES;
  return [];
}

export function getFestivosPorEmpresa(empresaId: string): Festivo[] {
  if (empresaId === "habana") return HABANA_FESTIVOS;
  if (empresaId === "bacanal") return BACANAL_FESTIVOS;
  return [];
}

export function getBajasPorEmpresa(empresaId: string): BajaMedica[] {
  if (empresaId === "habana") return HABANA_BAJAS;
  if (empresaId === "bacanal") return BACANAL_BAJAS;
  return [];
}

export function getJustificadasPorEmpresa(empresaId: string): Justificada[] {
  if (empresaId === "habana") return HABANA_JUSTIFICADAS;
  if (empresaId === "bacanal") return BACANAL_JUSTIFICADAS;
  return [];
}

export function getConfigCalendario(modalidad: string): ConfigCalendario {
  const base: ConfigCalendario = {
    tiposSolicitud: [],
    estados: ["pendiente", "aprobada", "rechazada"],
    requiereAprobacion: true,
    requiereJustificante: false,
    observacionesObligatorias: false,
    colorPrincipal: "sky",
    visibilidad: "todos",
  };
  switch (modalidad) {
    case "laboral": return { ...base, requiereAprobacion: false, tiposSolicitud: ["Turno mañana", "Turno tarde", "Turno noche", "Turno partido"], colorPrincipal: "sky" };
    case "vacaciones": return { ...base, tiposSolicitud: ["Vacaciones anuales", "Días de asuntos propios", "Permiso retribuido"], duracionMaxDias: 30, duracionMinDias: 1, colorPrincipal: "emerald" };
    case "festivos": return { ...base, requiereAprobacion: false, requiereJustificante: false, tiposSolicitud: ["General", "Local", "Autonómico"], colorPrincipal: "amber" };
    case "bajas": return { ...base, requiereJustificante: true, observacionesObligatorias: true, tiposSolicitud: ["Enfermedad común", "Accidente laboral", "Intervención quirúrgica"], colorPrincipal: "rose" };
    case "justificadas": return { ...base, requiereJustificante: true, tiposSolicitud: ["Asunto personal", "Familiar", "Formación", "Trámite oficial", "Otros"], colorPrincipal: "violet" };
    default: return base;
  }
}
