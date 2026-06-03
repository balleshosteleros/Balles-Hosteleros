/**
 * Seed canónico de PLANTILLAS DE EMAIL del módulo de Reservas.
 *
 * Cada empresa arranca con una fila por tipo de email. Lo único que la empresa
 * puede editar es `asunto_personalizado` y `mensaje_personalizado` (texto libre
 * que se inyecta en el correo); el resto (logo, datos de la reserva, footer)
 * viene de fábrica y no es editable.
 *
 * Modo de sincronización: ADITIVO. Solo crea los tipos que faltan en la empresa.
 *
 * Placeholders disponibles en el mensaje personalizado:
 *   {{nombre}}        → nombre del cliente
 *   {{empresa}}       → nombre de la empresa
 *   {{fecha}}         → fecha legible (ej. "martes, 2 de junio de 2026")
 *   {{hora}}          → hora HH:MM
 *   {{personas}}      → nº de comensales
 *   {{mesa}}          → código de mesa (puede ir vacío)
 *   {{zona}}          → nombre de la zona
 */

export type ReservaEmailTipo =
  | "CONFIRMACION"
  | "RECONFIRMACION"
  | "RECORDATORIO"
  | "CANCELACION"
  | "POLITICA_AVISO"
  | "CUPON_PAGADO";

export const RESERVA_EMAIL_TIPOS: ReservaEmailTipo[] = [
  "CONFIRMACION",
  "RECONFIRMACION",
  "RECORDATORIO",
  "CANCELACION",
  "POLITICA_AVISO",
  "CUPON_PAGADO",
];

export const RESERVA_EMAIL_TIPO_LABELS: Record<ReservaEmailTipo, string> = {
  CONFIRMACION: "Confirmación de reserva",
  RECONFIRMACION: "Reconfirmación",
  RECORDATORIO: "Recordatorio",
  CANCELACION: "Cancelación",
  POLITICA_AVISO: "Aviso de política de cancelación",
  CUPON_PAGADO: "Cupón pagado",
};

/**
 * Algunos tipos NO envían correo aparte: solo añaden un bloque al correo de
 * confirmación cuando aplica (reserva con política o con cupón).
 */
export const RESERVA_EMAIL_TIPO_ES_BLOQUE: Record<ReservaEmailTipo, boolean> = {
  CONFIRMACION: false,
  RECONFIRMACION: false,
  RECORDATORIO: false,
  CANCELACION: false,
  POLITICA_AVISO: true,
  CUPON_PAGADO: true,
};

export const RESERVA_EMAIL_TIPO_DESCRIPCION: Record<ReservaEmailTipo, string> = {
  CONFIRMACION: "Se envía al crear la reserva si el cliente tiene email.",
  RECONFIRMACION:
    "Se envía X días antes de la reserva (configurable). Pide al cliente que confirme su asistencia.",
  RECORDATORIO:
    "Se envía X horas antes de la reserva (configurable). Recordatorio de cortesía.",
  CANCELACION: "Se envía cuando la reserva pasa al estado Cancelada.",
  POLITICA_AVISO:
    "Bloque que se añade al correo de confirmación cuando la reserva tiene política de cancelación.",
  CUPON_PAGADO:
    "Bloque que se añade al correo de confirmación cuando el cliente ya ha pagado por adelantado (cupón).",
};

export interface ReservaEmailPlantillaSeed {
  tipo: ReservaEmailTipo;
  asunto_default: string;
  mensaje_default: string;
}

export const RESERVA_EMAIL_PLANTILLAS_SEED: ReservaEmailPlantillaSeed[] = [
  {
    tipo: "CONFIRMACION",
    asunto_default: "Reserva confirmada · {{fecha}} {{hora}} · {{empresa}}",
    mensaje_default: "",
  },
  {
    tipo: "RECONFIRMACION",
    asunto_default: "¿Mantienes tu reserva? · {{fecha}} {{hora}} · {{empresa}}",
    mensaje_default:
      "Te escribimos para confirmar que mantienes la reserva. Si no nos contestas a este correo daremos por hecho que vienes.",
  },
  {
    tipo: "RECORDATORIO",
    asunto_default: "Te esperamos hoy a las {{hora}} · {{empresa}}",
    mensaje_default: "Hoy es el día. Te recordamos los detalles de tu reserva.",
  },
  {
    tipo: "CANCELACION",
    asunto_default: "Reserva cancelada · {{fecha}} {{hora}} · {{empresa}}",
    mensaje_default:
      "Hemos cancelado tu reserva. Si crees que es un error, responde a este correo y lo revisamos.",
  },
  {
    tipo: "POLITICA_AVISO",
    asunto_default: "", // no aplica — es bloque
    mensaje_default:
      "Tu reserva está sujeta a política de cancelación. Si cancelas con menos antelación o no te presentas, se cobrará el importe indicado.",
  },
  {
    tipo: "CUPON_PAGADO",
    asunto_default: "", // no aplica — es bloque
    mensaje_default:
      "Hemos recibido tu pago por adelantado. Trae este correo el día de la reserva como comprobante.",
  },
];

/**
 * Devuelve la plantilla del seed por tipo, o null si no existe.
 */
export function getReservaEmailPlantillaSeed(
  tipo: ReservaEmailTipo,
): ReservaEmailPlantillaSeed | null {
  return RESERVA_EMAIL_PLANTILLAS_SEED.find((p) => p.tipo === tipo) ?? null;
}
