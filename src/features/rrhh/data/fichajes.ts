export type EstadoFichaje =
  | "pendiente"
  | "trabajando"
  | "pausa"
  | "completado"
  | "completo"
  | "incompleto"
  | "incidencia"
  | "validado";

export type TipoFichajeCodigo = "ENT" | "SAL" | "IPA" | "FPA" | "MAN" | "COR" | "VAL" | "NOR";

export const TIPO_FICHAJE_LABEL: Record<TipoFichajeCodigo, string> = {
  ENT: "Normal",
  SAL: "Salida",
  IPA: "En pausa",
  FPA: "Fin pausa",
  MAN: "Manual",
  COR: "Corregido",
  VAL: "Validado",
  NOR: "Normal",
};

export const TIPO_FICHAJE_BADGE: Record<TipoFichajeCodigo, string> = {
  ENT: "bg-sky-50 text-sky-700 border-sky-200",
  SAL: "bg-sky-50 text-sky-700 border-sky-200",
  IPA: "bg-amber-50 text-amber-700 border-amber-200",
  FPA: "bg-amber-50 text-amber-700 border-amber-200",
  MAN: "bg-violet-50 text-violet-700 border-violet-200",
  COR: "bg-orange-50 text-orange-700 border-orange-200",
  VAL: "bg-emerald-50 text-emerald-700 border-emerald-200",
  NOR: "bg-sky-50 text-sky-700 border-sky-200",
};

// ─── Paleta de color de los tipos de fichaje (fuente única) ────────────────
// Cada tipo (`tipos_fichaje.color`) guarda una CLAVE de esta paleta; de ella
// se derivan tanto el punto (dot) como el badge (badge) para pintar el fichaje
// según su tipo. No guardar clases Tailwind completas en BD: solo la clave.
export type FichajeColorKey =
  | "slate" | "sky" | "blue" | "indigo" | "violet" | "fuchsia"
  | "rose" | "red" | "orange" | "amber" | "emerald" | "teal";

export const FICHAJE_COLOR_PALETTE: { key: FichajeColorKey; label: string }[] = [
  { key: "sky", label: "Azul cielo" },
  { key: "blue", label: "Azul" },
  { key: "indigo", label: "Índigo" },
  { key: "violet", label: "Violeta" },
  { key: "fuchsia", label: "Fucsia" },
  { key: "rose", label: "Rosa" },
  { key: "red", label: "Rojo" },
  { key: "orange", label: "Naranja" },
  { key: "amber", label: "Ámbar" },
  { key: "emerald", label: "Verde" },
  { key: "teal", label: "Turquesa" },
  { key: "slate", label: "Gris" },
];

const FICHAJE_COLOR_DOT: Record<FichajeColorKey, string> = {
  slate: "bg-slate-500", sky: "bg-sky-500", blue: "bg-blue-500",
  indigo: "bg-indigo-500", violet: "bg-violet-500", fuchsia: "bg-fuchsia-500",
  rose: "bg-rose-500", red: "bg-red-500", orange: "bg-orange-500",
  amber: "bg-amber-500", emerald: "bg-emerald-500", teal: "bg-teal-500",
};

const FICHAJE_COLOR_BADGE: Record<FichajeColorKey, string> = {
  slate: "bg-slate-50 text-slate-700 border-slate-200",
  sky: "bg-sky-50 text-sky-700 border-sky-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  fuchsia: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  red: "bg-red-50 text-red-700 border-red-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  teal: "bg-teal-50 text-teal-700 border-teal-200",
};

function normalizeColorKey(color?: string | null): FichajeColorKey {
  const k = (color ?? "").toLowerCase() as FichajeColorKey;
  return k in FICHAJE_COLOR_DOT ? k : "slate";
}

/** Clase del punto de color (bg-*-500) para una clave de color de tipo. */
export function fichajeColorDot(color?: string | null): string {
  return FICHAJE_COLOR_DOT[normalizeColorKey(color)];
}

/** Clases del badge (bg-50 / text-700 / border-200) para una clave de color. */
export function fichajeColorBadge(color?: string | null): string {
  return FICHAJE_COLOR_BADGE[normalizeColorKey(color)];
}

/**
 * Local con geolocalización tal y como lo necesita la auditoría geográfica
 * de fichajes (PRP-037). Estructura camelCase y se construye en el server
 * mapeando desde `locales` (snake_case).
 */
export interface LocalGeo {
  id: string;
  nombre: string;
  lat: number | null;
  lng: number | null;
  radioMetros: number;
  color: string;
}

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
  tipo?: TipoFichajeCodigo;
  // ─── Auditoría geográfica (PRP-037) ────────────────────────────────
  // Todos los campos son opcionales para mantener backward-compat con
  // consumidores que aún no mapean estos datos (p.ej. FichajesView pre
  // TASK-002.02). El server (`listFichajes`) los rellena precalculados;
  // los consumidores que no los pueblan dejan `undefined` y el helper
  // `getFichajeGeoStatus` los trata como `sin-datos`.
  latEntrada?: number | null;
  lngEntrada?: number | null;
  precisionEntradaMetros?: number | null;
  latSalida?: number | null;
  lngSalida?: number | null;
  precisionSalidaMetros?: number | null;
  modoTeletrabajo?: boolean;
  local?: LocalGeo | null;
  distanciaEntradaMetros?: number | null;
  distanciaSalidaMetros?: number | null;
  // ─── Paralización (cierre anticipado manual) ──────────────────────
  cierreAnticipado?: boolean;
  cierreAnticipadoMotivo?: string | null;
  // ─── Hora real vs oficial (PRP-060) ───────────────────────────────
  // `horaEntrada`/`horaSalida` son la OFICIAL (redondeada, la que cuenta).
  // Estas son la hora FÍSICA del fichaje (informativa); null en fichajes
  // antiguos o en cierres automáticos (no fichó).
  horaEntradaReal?: string | null;
  horaSalidaReal?: string | null;
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
  completado: "Correcto",
  completo: "Correcto",
  incompleto: "Incompleto",
  incidencia: "Incidencia",
  pausa: "En pausa",
  pendiente: "Pendiente",
  trabajando: "Trabajando",
  validado: "Validado",
};

export const ESTADO_FICHAJE_COLOR: Record<EstadoFichaje, string> = {
  completado: "bg-emerald-500",
  completo: "bg-emerald-500",
  incompleto: "bg-amber-400",
  incidencia: "bg-destructive",
  pausa: "bg-amber-400",
  pendiente: "bg-muted-foreground/40",
  trabajando: "bg-blue-500",
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
