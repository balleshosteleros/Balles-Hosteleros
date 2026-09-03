export type SolicitudTipo = "ausencia" | "trabajo" | "entrega" | "queja";

export type SolicitudSubtipoAusencia =
  | "baja_medica"
  | "vacaciones"
  | "permiso"
  | "baja_contrato";
export type SolicitudSubtipoTrabajo = "horas_extras" | "dia_trabajado";
/** Pedir uniforme o material. Al aprobarla se crea la entrega de verdad. */
export type SolicitudSubtipoEntrega = "entrega_material";
/** Las quejas y denuncias viven en su propia tabla, pero se listan aquí como un tipo más. */
export type SolicitudSubtipoQueja = "denuncia";
export type SolicitudSubtipo =
  | SolicitudSubtipoAusencia
  | SolicitudSubtipoTrabajo
  | SolicitudSubtipoEntrega
  | SolicitudSubtipoQueja;

export type SolicitudEstado = "pendiente" | "aprobada" | "rechazada" | "anulada";

/**
 * Longitud mínima del motivo en las solicitudes de horas extras: quien las
 * aprueba necesita saber por qué se hicieron, no vale dejarlo en blanco.
 */
export const HORAS_EXTRAS_MOTIVO_MIN = 15;

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
  /**
   * Quién la resolvió. El permiso para validar es del DEPARTAMENTO, pero quien
   * aprueba o deniega es una persona concreta y queda su nombre como firma.
   */
  revisadoPor: string | null;
  revisadoAt: string | null;
  /** Qué pidió, solo en las solicitudes de entrega de material. */
  entregaTipoId?: string | null;
  entregaTipoNombre?: string | null;
  entregaTalla?: string | null;
  /** Entrega creada al aprobarla. NULL mientras está pendiente o si se denegó. */
  entregaId?: string | null;
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
  modoTeletrabajo: boolean;
  /** Nombre del local donde fichó (presencial). En teletrabajo no aplica. */
  local: string | null;
  /** Jornada flexible hoy: objetivo de horas con autocierre y bloqueo. */
  flexible: boolean;
  /** Ámbito del objetivo flexible: 'diario' o 'semanal'. */
  flexModo: "diario" | "semanal" | null;
  /** Objetivo de horas del periodo (día o semana) si la jornada es flexible. */
  flexObjetivoHoras: number | null;
  /** Horas que aún puede acumular este fichaje antes del autocierre. */
  flexRestanteHoras: number | null;
  /**
   * Zona horaria (IANA) de la empresa del fichaje, para formatear sus horas en
   * la hora real del local. El historial es multi-empresa: cada fila lleva la
   * suya. Fallback "Europe/Madrid". Ver PRP-069.
   */
  zonaHoraria: string;
}

export interface DiaCalendario {
  fecha: string;
  fichado: boolean;
  horasFichaje: number;
  ausencia: SolicitudSubtipoAusencia | null;
  trabajoExtra: SolicitudSubtipoTrabajo | null;
  /**
   * Horario PREVISTO ese día según los turnos y patrones reales del empleado.
   * `null` = no se ha resuelto; `trabaja:false` = libra.
   *
   * Antes el calendario pintaba una tabla fija escrita en el cliente, igual
   * para todo el mundo, así que enseñaba turnos que no existían y marcaba como
   * laborables días que el empleado libraba.
   */
  horarioPrevisto: {
    trabaja: boolean;
    /** "21:30–02:30", o varios tramos separados por coma. "" si libra. */
    texto: string;
  } | null;
}

export const SUBTIPO_LABEL: Record<SolicitudSubtipo, string> = {
  baja_medica: "Baja médica",
  vacaciones: "Vacaciones",
  permiso: "Permiso",
  baja_contrato: "Baja de contrato",
  horas_extras: "Horas extras",
  dia_trabajado: "Día trabajado",
  entrega_material: "Uniforme o material",
  denuncia: "Queja o denuncia",
};

export const ESTADO_LABEL: Record<SolicitudEstado, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  anulada: "Anulada por el empleado",
};

export const ESTADO_COLOR: Record<SolicitudEstado, string> = {
  pendiente: "bg-amber-100 text-amber-800 border-amber-200",
  aprobada: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rechazada: "bg-rose-100 text-rose-800 border-rose-200",
  anulada: "bg-slate-100 text-slate-700 border-slate-200",
};
