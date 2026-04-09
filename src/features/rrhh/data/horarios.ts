export interface Turno {
  id: string;
  nombre: string;
  codigo: string;
  horaInicio: string;
  horaFin: string;
  duracion: number;
  color: string;
  descripcion: string;
  activo: boolean;
  toleranciaMinutos: number;
  centro?: string;
  departamento?: string;
}

export interface Descanso {
  id: string;
  nombre: string;
  duracionMinutos: number;
  obligatorio: boolean;
  remunerado: boolean;
  descuentaJornada: boolean;
  descripcion: string;
  activo: boolean;
}

export interface Patron {
  id: string;
  nombre: string;
  descripcion: string;
  turnos: string[];
  dias: string[];
  duracionDias: number;
  repetible: boolean;
  centro?: string;
  departamento?: string;
  activo: boolean;
}

export interface TipoFichaje {
  id: string;
  nombre: string;
  codigo: string;
  descripcion: string;
  computaTiempo: boolean;
  activo: boolean;
}

export interface TipoAusencia {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  requiereAprobacion: boolean;
  requiereJustificante: boolean;
  descuentaJornada: boolean;
  reflejaCalendario: boolean;
  color: string;
  activo: boolean;
}

const HABANA_TURNOS: Turno[] = [
  { id: "ht1", nombre: "Mañana", codigo: "MAN", horaInicio: "08:00", horaFin: "16:00", duracion: 8, color: "bg-sky-500", descripcion: "Turno de mañana estándar", activo: true, toleranciaMinutos: 10 },
  { id: "ht2", nombre: "Tarde", codigo: "TAR", horaInicio: "16:00", horaFin: "00:00", duracion: 8, color: "bg-amber-500", descripcion: "Turno de tarde estándar", activo: true, toleranciaMinutos: 10 },
  { id: "ht3", nombre: "Noche", codigo: "NOC", horaInicio: "22:00", horaFin: "06:00", duracion: 8, color: "bg-violet-500", descripcion: "Turno de noche", activo: true, toleranciaMinutos: 15 },
  { id: "ht4", nombre: "Partido", codigo: "PAR", horaInicio: "10:00", horaFin: "14:00", duracion: 8, color: "bg-emerald-500", descripcion: "Turno partido mañana+tarde", activo: true, toleranciaMinutos: 10 },
  { id: "ht5", nombre: "Media jornada", codigo: "MED", horaInicio: "09:00", horaFin: "13:00", duracion: 4, color: "bg-teal-500", descripcion: "Media jornada", activo: true, toleranciaMinutos: 5 },
  { id: "ht6", nombre: "Cierre", codigo: "CIE", horaInicio: "18:00", horaFin: "03:00", duracion: 9, color: "bg-rose-500", descripcion: "Turno de cierre", activo: false, toleranciaMinutos: 15 },
];

const BACANAL_TURNOS: Turno[] = [
  { id: "bt1", nombre: "Mañana", codigo: "MAN", horaInicio: "09:00", horaFin: "17:00", duracion: 8, color: "bg-sky-500", descripcion: "Turno de mañana", activo: true, toleranciaMinutos: 10 },
  { id: "bt2", nombre: "Noche sala", codigo: "NS", horaInicio: "20:00", horaFin: "04:00", duracion: 8, color: "bg-violet-500", descripcion: "Turno noche sala", activo: true, toleranciaMinutos: 15 },
  { id: "bt3", nombre: "Cocina intensivo", codigo: "COC", horaInicio: "12:00", horaFin: "22:00", duracion: 10, color: "bg-amber-500", descripcion: "Turno cocina intensivo", activo: true, toleranciaMinutos: 10 },
  { id: "bt4", nombre: "Fin de semana", codigo: "FDS", horaInicio: "16:00", horaFin: "02:00", duracion: 10, color: "bg-rose-500", descripcion: "Turno fin de semana", activo: true, toleranciaMinutos: 10 },
];

const HABANA_DESCANSOS: Descanso[] = [
  { id: "hd1", nombre: "Pausa comida", duracionMinutos: 30, obligatorio: true, remunerado: false, descuentaJornada: true, descripcion: "Pausa para comer", activo: true },
  { id: "hd2", nombre: "Descanso corto", duracionMinutos: 15, obligatorio: false, remunerado: true, descuentaJornada: false, descripcion: "Descanso breve remunerado", activo: true },
  { id: "hd3", nombre: "Descanso no remunerado", duracionMinutos: 60, obligatorio: false, remunerado: false, descuentaJornada: true, descripcion: "Pausa larga no remunerada", activo: false },
];

const BACANAL_DESCANSOS: Descanso[] = [
  { id: "bd1", nombre: "Pausa comida", duracionMinutos: 45, obligatorio: true, remunerado: false, descuentaJornada: true, descripcion: "Pausa para comer", activo: true },
  { id: "bd2", nombre: "Pausa operativa", duracionMinutos: 10, obligatorio: false, remunerado: true, descuentaJornada: false, descripcion: "Pausa operativa corta", activo: true },
];

const HABANA_PATRONES: Patron[] = [
  { id: "hp1", nombre: "L-V Mañana", descripcion: "Lunes a viernes turno de mañana", turnos: ["ht1"], dias: ["L", "M", "X", "J", "V"], duracionDias: 5, repetible: true, activo: true },
  { id: "hp2", nombre: "Fin de semana noche", descripcion: "Sábado y domingo turno noche", turnos: ["ht3"], dias: ["S", "D"], duracionDias: 2, repetible: true, activo: true },
  { id: "hp3", nombre: "Rotativo 2+2+2", descripcion: "2 mañanas + 2 tardes + 2 descansos", turnos: ["ht1", "ht1", "ht2", "ht2"], dias: ["L", "M", "X", "J"], duracionDias: 6, repetible: true, activo: true },
];

const BACANAL_PATRONES: Patron[] = [
  { id: "bp1", nombre: "Sala rotativo", descripcion: "Rotación sala semanal", turnos: ["bt1", "bt2"], dias: ["L", "M", "X", "J", "V"], duracionDias: 5, repetible: true, activo: true },
  { id: "bp2", nombre: "Cocina intensivo", descripcion: "Cocina intensivo L-V", turnos: ["bt3"], dias: ["L", "M", "X", "J", "V"], duracionDias: 5, repetible: true, activo: true },
];

const TIPOS_FICHAJE: TipoFichaje[] = [
  { id: "tf1", nombre: "Entrada", codigo: "ENT", descripcion: "Fichaje de entrada", computaTiempo: true, activo: true },
  { id: "tf2", nombre: "Salida", codigo: "SAL", descripcion: "Fichaje de salida", computaTiempo: true, activo: true },
  { id: "tf3", nombre: "Inicio pausa", codigo: "IPA", descripcion: "Inicio de pausa", computaTiempo: false, activo: true },
  { id: "tf4", nombre: "Fin pausa", codigo: "FPA", descripcion: "Fin de pausa", computaTiempo: false, activo: true },
  { id: "tf5", nombre: "Fichaje manual", codigo: "MAN", descripcion: "Fichaje registrado manualmente", computaTiempo: true, activo: true },
  { id: "tf6", nombre: "Fichaje corregido", codigo: "COR", descripcion: "Fichaje corregido por responsable", computaTiempo: true, activo: true },
  { id: "tf7", nombre: "Fichaje validado", codigo: "VAL", descripcion: "Fichaje validado por supervisor", computaTiempo: true, activo: false },
];

const TIPOS_AUSENCIA: TipoAusencia[] = [
  { id: "ta1", nombre: "Vacaciones", descripcion: "Vacaciones anuales", categoria: "Vacaciones", requiereAprobacion: true, requiereJustificante: false, descuentaJornada: true, reflejaCalendario: true, color: "bg-emerald-500", activo: true },
  { id: "ta2", nombre: "Festivo", descripcion: "Día festivo oficial", categoria: "Festivos", requiereAprobacion: false, requiereJustificante: false, descuentaJornada: false, reflejaCalendario: true, color: "bg-amber-500", activo: true },
  { id: "ta3", nombre: "Baja médica", descripcion: "Baja por enfermedad o accidente", categoria: "Bajas médicas", requiereAprobacion: false, requiereJustificante: true, descuentaJornada: true, reflejaCalendario: true, color: "bg-rose-500", activo: true },
  { id: "ta4", nombre: "Ausencia justificada", descripcion: "Ausencia con justificación válida", categoria: "Justificadas", requiereAprobacion: true, requiereJustificante: true, descuentaJornada: false, reflejaCalendario: true, color: "bg-violet-500", activo: true },
  { id: "ta5", nombre: "Permiso retribuido", descripcion: "Permiso con retribución", categoria: "Justificadas", requiereAprobacion: true, requiereJustificante: false, descuentaJornada: false, reflejaCalendario: true, color: "bg-sky-500", activo: true },
  { id: "ta6", nombre: "Asunto personal", descripcion: "Día de asuntos propios", categoria: "Justificadas", requiereAprobacion: true, requiereJustificante: false, descuentaJornada: true, reflejaCalendario: true, color: "bg-teal-500", activo: true },
  { id: "ta7", nombre: "Ausencia no justificada", descripcion: "Ausencia sin justificación", categoria: "No justificadas", requiereAprobacion: false, requiereJustificante: false, descuentaJornada: true, reflejaCalendario: true, color: "bg-destructive", activo: true },
];

export function getTurnosConfigPorEmpresa(empresaId: string): Turno[] {
  if (empresaId === "habana") return HABANA_TURNOS;
  if (empresaId === "bacanal") return BACANAL_TURNOS;
  return [];
}

export function getDescansosPorEmpresa(empresaId: string): Descanso[] {
  if (empresaId === "habana") return HABANA_DESCANSOS;
  if (empresaId === "bacanal") return BACANAL_DESCANSOS;
  return [];
}

export function getPatronesPorEmpresa(empresaId: string): Patron[] {
  if (empresaId === "habana") return HABANA_PATRONES;
  if (empresaId === "bacanal") return BACANAL_PATRONES;
  return [];
}

export function getTiposFichaje(): TipoFichaje[] {
  return TIPOS_FICHAJE;
}

export function getTiposAusencia(): TipoAusencia[] {
  return TIPOS_AUSENCIA;
}
