/**
 * Citas comerciales (PRP-088).
 *
 * Reuniones que alguien reserva desde fuera: llega por un embudo, elige hueco y
 * queda citado con una persona del equipo. Cada ESTRATEGIA tiene su propio
 * calendario, con su duración y sus normas.
 */

export type CitaEstado = "CONFIRMADA" | "CANCELADA" | "REALIZADA" | "NO_ASISTE";

export const CITA_ESTADOS: CitaEstado[] = ["CONFIRMADA", "REALIZADA", "NO_ASISTE", "CANCELADA"];

export const CITA_ESTADO_LABEL: Record<CitaEstado, string> = {
  CONFIRMADA: "Confirmada",
  REALIZADA: "Realizada",
  NO_ASISTE: "No asiste",
  CANCELADA: "Cancelada",
};

export interface CitaCalendario {
  id: string;
  empresa_id: string;
  nombre: string;
  descripcion: string | null;
  /** Cuánto dura la reunión. */
  duracion_min: number;
  /** Cada cuánto empieza un hueco (30 min → 10:00, 10:30, 11:00…). */
  paso_min: number;
  /** Colchón por delante: nadie reserva para dentro de diez minutos. */
  antelacion_min_horas: number;
  /** Hasta cuántos días hacia delante se puede reservar. */
  dias_vista: number;
  color: string | null;
  activo: boolean;
  /**
   * Cuenta de Google en cuyo calendario se apuntan los eventos de este
   * calendario. Quien reserva es anónimo y no tiene sesión de la que sacar el
   * permiso, así que la cuenta se designa aquí, desde el engranaje.
   */
  google_cuenta_email: string | null;
  /** Usuario del software cuyo permiso de Google se usa. Lo pone el servidor. */
  google_user_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Cuenta de Google que se puede elegir para un calendario. Sin secretos. */
export interface CuentaGoogleElegible {
  email: string;
  nombre: string;
  /** true = está conectada por quien está mirando; false = la puso otra persona. */
  propia: boolean;
}

/** Franja en la que se puede reservar. Las horas son de la EMPRESA, no del navegador. */
export interface CitaDisponibilidad {
  id: string;
  calendario_id: string;
  /** null = la franja vale para todo el calendario. */
  empleado_id: string | null;
  /** 1 = lunes … 7 = domingo. */
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
}

export interface Cita {
  id: string;
  empresa_id: string;
  calendario_id: string;
  empleado_id: string | null;
  cliente_id: string | null;
  inicio: string;
  fin: string;
  estado: CitaEstado;
  pagina_id: string | null;
  origen: string | null;
  notas: string | null;
  google_event_id: string | null;
  google_cuenta_email: string | null;
  /** Enlace de la videollamada. Es el que va en el correo de confirmación. */
  google_meet_url: string | null;
  created_at: string;
  updated_at: string;
}

/** Una cita con lo que hace falta para pintarla sin más consultas. */
export interface CitaConDetalle extends Cita {
  calendario_nombre: string | null;
  calendario_color: string | null;
  empleado_nombre: string | null;
  cliente_nombre: string | null;
  cliente_email: string | null;
  cliente_telefono: string | null;
}

export interface EmpleadoDeCalendario {
  id: string;
  nombre: string;
}
