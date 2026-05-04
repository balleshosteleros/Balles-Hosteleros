export type SolicitudTipo = "ausencia" | "trabajo";

export type SolicitudSubtipoAusencia = "baja_medica" | "vacaciones" | "permiso";
export type SolicitudSubtipoTrabajo = "horas_extras" | "dia_trabajado";
export type SolicitudSubtipo = SolicitudSubtipoAusencia | SolicitudSubtipoTrabajo;

export type SolicitudEstado = "pendiente" | "aprobada" | "rechazada" | "anulada";

export interface SolicitudPersonal {
  id: string;
  empresaId: string;
  userId: string;
  empleadoNombre: string;
  tipo: SolicitudTipo;
  subtipo: SolicitudSubtipo;
  fechaInicio: string;
  fechaFin: string | null;
  horas: number | null;
  motivo: string;
  estado: SolicitudEstado;
  createdAt: string;
}

export interface MiFichajeHoy {
  id: string;
  fecha: string;
  horaEntrada: string | null;
  horaSalida: string | null;
  pausaInicio: string | null;
  pausaFin: string | null;
  horasTotales: number;
  estado: string;
  incidencia: string | null;
}

export interface DiaCalendario {
  fecha: string;
  fichado: boolean;
  horasFichaje: number;
  ausencia: SolicitudSubtipoAusencia | null;
  trabajoExtra: SolicitudSubtipoTrabajo | null;
}

export const SUBTIPO_LABEL: Record<SolicitudSubtipo, string> = {
  baja_medica: "Baja médica",
  vacaciones: "Vacaciones",
  permiso: "Permiso",
  horas_extras: "Horas extras",
  dia_trabajado: "Día trabajado",
};

export const ESTADO_LABEL: Record<SolicitudEstado, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  anulada: "Anulada",
};

export const ESTADO_COLOR: Record<SolicitudEstado, string> = {
  pendiente: "bg-amber-100 text-amber-800 border-amber-200",
  aprobada: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rechazada: "bg-rose-100 text-rose-800 border-rose-200",
  anulada: "bg-slate-100 text-slate-700 border-slate-200",
};
