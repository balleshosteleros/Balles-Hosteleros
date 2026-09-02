/**
 * Catálogo de avisos de mensajería (WhatsApp/SMS) y estados de alta.
 *
 * Vive FUERA de `actions/config-actions.ts` a propósito: aquel archivo es
 * `"use server"`, y un módulo `"use server"` solo puede exportar funciones
 * async. Al exportar de allí estas constantes, Next tumbaba el módulo entero de
 * server actions de la página de Reservas ("A 'use server' file can only export
 * async functions, found object"), y la pantalla se quedaba sin cargar con un
 * "Error de conexión al cargar reservas".
 */

export type EstadoAlta =
  | "SIN_CONECTAR"
  | "PENDIENTE_VERIFICACION"
  | "ACTIVO"
  | "SUSPENDIDO";

/** Tipos de aviso que pueden salir por WhatsApp. La valoración no está: pedir
 *  opinión por WhatsApp quema el canal, y para eso el correo ya funciona. */
export const TIPOS_AVISO = [
  "CONFIRMACION",
  "RECONFIRMACION",
  "RECORDATORIO",
  "CANCELACION",
] as const;

export type TipoAviso = (typeof TIPOS_AVISO)[number];

export const TIPO_AVISO_LABEL: Record<TipoAviso, string> = {
  CONFIRMACION: "Confirmación al reservar",
  RECONFIRMACION: "Reconfirmación",
  RECORDATORIO: "Recordatorio",
  CANCELACION: "Aviso de cancelación",
};

export const TIPO_AVISO_DESCRIPCION: Record<TipoAviso, string> = {
  CONFIRMACION: "Nada más hacer la reserva, con el enlace para cancelar.",
  RECONFIRMACION: "Los días antes, para que confirme que viene. Es el que más mesas salva.",
  RECORDATORIO: "El mismo día, unas horas antes.",
  CANCELACION: "Cuando la reserva se cancela.",
};
