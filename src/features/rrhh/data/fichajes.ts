export type EstadoFichaje = "completo" | "incompleto" | "incidencia" | "pendiente" | "validado";

export interface Fichaje {
  id: string;
  empleadoId: string;
  empleadoNombre: string;
  fecha: string;
  horaEntrada: string | null;
  horaSalida: string | null;
  pausaInicio: string | null;
  pausaFin: string | null;
  horasTotales: number;
  estado: EstadoFichaje;
  incidencia: string | null;
  validadoPor: string | null;
  observaciones: string | null;
  departamento: string;
  centro: string;
}

export interface IncidenciaFichaje {
  id: string;
  fichajeId: string;
  empleadoNombre: string;
  fecha: string;
  tipo: TipoIncidencia;
  descripcion: string;
  resuelta: boolean;
}

export type TipoIncidencia =
  | "sin_fichaje"
  | "entrada_sin_salida"
  | "salida_sin_entrada"
  | "desfase_horario"
  | "fichaje_incompleto";

export const TIPOS_INCIDENCIA_LABEL: Record<TipoIncidencia, string> = {
  sin_fichaje: "No ha fichado",
  entrada_sin_salida: "Entrada sin salida",
  salida_sin_entrada: "Salida sin entrada",
  desfase_horario: "Desfase con horario",
  fichaje_incompleto: "Fichaje incompleto",
};

export const ESTADO_FICHAJE_LABEL: Record<EstadoFichaje, string> = {
  completo: "Completo",
  incompleto: "Incompleto",
  incidencia: "Incidencia",
  pendiente: "Pendiente",
  validado: "Validado",
};

export const ESTADO_FICHAJE_COLOR: Record<EstadoFichaje, string> = {
  completo: "bg-emerald-500",
  incompleto: "bg-amber-400",
  incidencia: "bg-destructive",
  pendiente: "bg-muted-foreground/40",
  validado: "bg-sky-500",
};

export interface ConfigFichajes {
  permitirManual: boolean;
  requiereValidacion: boolean;
  toleranciaMinutos: number;
  pausasActivas: boolean;
}

const CONFIG_DEFAULT: ConfigFichajes = {
  permitirManual: true,
  requiereValidacion: true,
  toleranciaMinutos: 10,
  pausasActivas: true,
};

const HABANA_FICHAJES: Fichaje[] = [
  { id: "fh1", empleadoId: "h2", empleadoNombre: "María García Fernández", fecha: "2026-04-06", horaEntrada: "10:00", horaSalida: "18:32", pausaInicio: "14:00", pausaFin: "14:30", horasTotales: 8.03, estado: "completo", incidencia: null, validadoPor: "Pedro Ruiz", observaciones: null, departamento: "JEFE DE SALA", centro: "Habana" },
  { id: "fh2", empleadoId: "h4", empleadoNombre: "Laura Sánchez Moreno", fecha: "2026-04-06", horaEntrada: "08:00", horaSalida: "16:15", pausaInicio: "13:00", pausaFin: "13:30", horasTotales: 7.75, estado: "validado", incidencia: null, validadoPor: null, observaciones: null, departamento: "DIRECCIÓN", centro: "Habana" },
  { id: "fh3", empleadoId: "h8", empleadoNombre: "Sofía Martín Herrero", fecha: "2026-04-06", horaEntrada: "16:00", horaSalida: "22:45", pausaInicio: null, pausaFin: null, horasTotales: 6.75, estado: "completo", incidencia: null, validadoPor: "Laura Sánchez", observaciones: null, departamento: "RRPP", centro: "Habana" },
  { id: "fh4", empleadoId: "h5", empleadoNombre: "Pedro Ruiz Navarro", fecha: "2026-04-06", horaEntrada: "09:00", horaSalida: null, pausaInicio: "13:30", pausaFin: "14:00", horasTotales: 0, estado: "incidencia", incidencia: "Entrada sin salida", validadoPor: null, observaciones: "Olvidó fichar salida", departamento: "GERENTE", centro: "Habana" },
  { id: "fh5", empleadoId: "h1", empleadoNombre: "Carlos Martínez López", fecha: "2026-04-06", horaEntrada: null, horaSalida: null, pausaInicio: null, pausaFin: null, horasTotales: 0, estado: "pendiente", incidencia: "No ha fichado", validadoPor: null, observaciones: null, departamento: "CACHIMBEROS", centro: "Habana" },
  { id: "fh6", empleadoId: "h6", empleadoNombre: "Ana López Díaz", fecha: "2026-04-05", horaEntrada: "17:00", horaSalida: "22:00", pausaInicio: null, pausaFin: null, horasTotales: 5, estado: "completo", incidencia: null, validadoPor: "María García", observaciones: null, departamento: "CAMAREROS", centro: "Habana" },
  { id: "fh7", empleadoId: "h3", empleadoNombre: "Alejandro Ruiz Torres", fecha: "2026-04-05", horaEntrada: "23:00", horaSalida: "03:00", pausaInicio: null, pausaFin: null, horasTotales: 4, estado: "validado", incidencia: null, validadoPor: "Laura Sánchez", observaciones: "Sesión DJ", departamento: "ARTISTAS", centro: "Habana" },
  { id: "fh8", empleadoId: "h10", empleadoNombre: "Elena Vega Prieto", fecha: "2026-04-05", horaEntrada: "18:00", horaSalida: "22:10", pausaInicio: null, pausaFin: null, horasTotales: 4.17, estado: "incompleto", incidencia: "Desfase con horario", validadoPor: null, observaciones: "Salió 10 min tarde", departamento: "CAMAREROS", centro: "Habana" },
];

const BACANAL_FICHAJES: Fichaje[] = [
  { id: "fb1", empleadoId: "b1", empleadoNombre: "Andrés Jiménez Ramos", fecha: "2026-04-06", horaEntrada: "08:00", horaSalida: "15:20", pausaInicio: "12:00", pausaFin: "12:30", horasTotales: 6.83, estado: "completo", incidencia: null, validadoPor: null, observaciones: null, departamento: "DIRECCIÓN", centro: "Bacanal" },
  { id: "fb2", empleadoId: "b3", empleadoNombre: "Miguel Santos Gil", fecha: "2026-04-06", horaEntrada: "17:00", horaSalida: "22:10", pausaInicio: null, pausaFin: null, horasTotales: 5.17, estado: "completo", incidencia: null, validadoPor: "Lucía Pérez", observaciones: null, departamento: "CAMAREROS", centro: "Bacanal" },
  { id: "fb3", empleadoId: "b6", empleadoNombre: "Isabel Domínguez Lara", fecha: "2026-04-06", horaEntrada: "09:00", horaSalida: "16:50", pausaInicio: "13:00", pausaFin: "13:30", horasTotales: 7.33, estado: "validado", incidencia: null, validadoPor: "Andrés Jiménez", observaciones: null, departamento: "ADMINISTRATIVO", centro: "Bacanal" },
  { id: "fb4", empleadoId: "b7", empleadoNombre: "Pablo Crespo Vargas", fecha: "2026-04-06", horaEntrada: null, horaSalida: null, pausaInicio: null, pausaFin: null, horasTotales: 0, estado: "incidencia", incidencia: "No ha fichado", validadoPor: null, observaciones: "Ausencia no justificada", departamento: "CACHIMBEROS", centro: "Bacanal" },
  { id: "fb5", empleadoId: "b4", empleadoNombre: "Carmen Morales Reyes", fecha: "2026-04-05", horaEntrada: "22:00", horaSalida: "02:00", pausaInicio: null, pausaFin: null, horasTotales: 4, estado: "completo", incidencia: null, validadoPor: "Andrés Jiménez", observaciones: "Sesión DJ", departamento: "ARTISTAS", centro: "Bacanal" },
  { id: "fb6", empleadoId: "b2", empleadoNombre: "Lucía Pérez Ortega", fecha: "2026-04-05", horaEntrada: "16:00", horaSalida: null, pausaInicio: null, pausaFin: null, horasTotales: 0, estado: "incidencia", incidencia: "Entrada sin salida", validadoPor: null, observaciones: null, departamento: "JEFE DE SALA", centro: "Bacanal" },
];

const HABANA_INCIDENCIAS: IncidenciaFichaje[] = [
  { id: "ih1", fichajeId: "fh4", empleadoNombre: "Pedro Ruiz Navarro", fecha: "2026-04-06", tipo: "entrada_sin_salida", descripcion: "Fichó entrada a las 09:00 pero no registró salida", resuelta: false },
  { id: "ih2", fichajeId: "fh5", empleadoNombre: "Carlos Martínez López", fecha: "2026-04-06", tipo: "sin_fichaje", descripcion: "No fichó teniendo horario asignado", resuelta: false },
  { id: "ih3", fichajeId: "fh8", empleadoNombre: "Elena Vega Prieto", fecha: "2026-04-05", tipo: "desfase_horario", descripcion: "Salida 10 minutos fuera del horario previsto", resuelta: true },
];

const BACANAL_INCIDENCIAS: IncidenciaFichaje[] = [
  { id: "ib1", fichajeId: "fb4", empleadoNombre: "Pablo Crespo Vargas", fecha: "2026-04-06", tipo: "sin_fichaje", descripcion: "No fichó teniendo horario asignado", resuelta: false },
  { id: "ib2", fichajeId: "fb6", empleadoNombre: "Lucía Pérez Ortega", fecha: "2026-04-05", tipo: "entrada_sin_salida", descripcion: "Fichó entrada a las 16:00 pero no registró salida", resuelta: false },
];

export function getFichajesPorEmpresa(empresaId: string): Fichaje[] {
  if (empresaId === "habana") return HABANA_FICHAJES;
  if (empresaId === "bacanal") return BACANAL_FICHAJES;
  return [];
}

export function getIncidenciasPorEmpresa(empresaId: string): IncidenciaFichaje[] {
  if (empresaId === "habana") return HABANA_INCIDENCIAS;
  if (empresaId === "bacanal") return BACANAL_INCIDENCIAS;
  return [];
}

export function getConfigFichajes(): ConfigFichajes {
  return { ...CONFIG_DEFAULT };
}
