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
 * ── Dos familias, y solo dos ───────────────────────────────────────────────
 *
 * ESTADO   → un correo por cada estado real de la reserva. Se envía cuando la
 *            reserva ENTRA en ese estado. La lista sale de `ESTADOS_RESERVA`
 *            (`features/sala/data/reservas.ts`) MENOS `WALK_IN`, que no es un
 *            estado sino un ORIGEN: el cliente ya está sentado, entró sin
 *            reservar y no hay a quién escribir.
 *
 * POLITICA → un correo por proceso que NO es un cambio de estado: la compra de
 *            un producto Ticket, la reserva hecha con ese Ticket, y el aviso de
 *            cada una de las dos políticas económicas (cancelación y garantía).
 *
 * Placeholders disponibles en asunto y mensaje:
 *   {{nombre}}        → nombre del cliente
 *   {{empresa}}       → nombre de la empresa
 *   {{fecha}}         → fecha legible (ej. "martes, 2 de junio de 2026")
 *   {{hora}}          → hora HH:MM
 *   {{personas}}      → nº de comensales
 *   {{zona}}          → nombre de la zona
 */

/** Correos disparados por el ESTADO de la reserva. Uno por estado real. */
export type ReservaEmailTipoEstado =
  | "CONFIRMADA"
  | "RECONFIRMADA"
  | "NO_RECONFIRMADA"
  | "LISTA_ESPERA"
  | "LIBERADA"
  | "TERMINANDO"
  | "NO_SHOW"
  | "CANCELADA";

/**
 * Correos disparados por una POLÍTICA o proceso, no por un cambio de estado.
 *
 * RECORDATORIO y SOLICITUD_VALORACION viven aquí porque no responden a ningún
 * estado: son envíos programados por reloj (X horas antes / después) sobre una
 * reserva que no ha cambiado de nada.
 */
export type ReservaEmailTipoPolitica =
  | "TICKET_COMPRA"
  | "TICKET_RESERVA"
  | "POLITICA_CANCELACION"
  | "POLITICA_GARANTIA"
  | "GARANTIA_PENDIENTE"
  | "GARANTIA_SOLICITUD"
  | "GARANTIA_CADUCADA"
  | "RECORDATORIO"
  | "SOLICITUD_VALORACION";

export type ReservaEmailTipo = ReservaEmailTipoEstado | ReservaEmailTipoPolitica;

export type ReservaEmailFamilia = "ESTADO" | "POLITICA";

export const RESERVA_EMAIL_TIPOS_ESTADO: ReservaEmailTipoEstado[] = [
  "CONFIRMADA",
  "RECONFIRMADA",
  "NO_RECONFIRMADA",
  "LISTA_ESPERA",
  "LIBERADA",
  "TERMINANDO",
  "NO_SHOW",
  "CANCELADA",
];

export const RESERVA_EMAIL_TIPOS_POLITICA: ReservaEmailTipoPolitica[] = [
  "TICKET_COMPRA",
  "TICKET_RESERVA",
  "POLITICA_CANCELACION",
  "POLITICA_GARANTIA",
  "GARANTIA_PENDIENTE",
  "GARANTIA_SOLICITUD",
  "GARANTIA_CADUCADA",
  "RECORDATORIO",
  "SOLICITUD_VALORACION",
];

export const RESERVA_EMAIL_TIPOS: ReservaEmailTipo[] = [
  ...RESERVA_EMAIL_TIPOS_ESTADO,
  ...RESERVA_EMAIL_TIPOS_POLITICA,
];

export const RESERVA_EMAIL_TIPO_FAMILIA: Record<ReservaEmailTipo, ReservaEmailFamilia> = {
  CONFIRMADA: "ESTADO",
  RECONFIRMADA: "ESTADO",
  NO_RECONFIRMADA: "ESTADO",
  LISTA_ESPERA: "ESTADO",
  LIBERADA: "ESTADO",
  TERMINANDO: "ESTADO",
  NO_SHOW: "ESTADO",
  CANCELADA: "ESTADO",
  TICKET_COMPRA: "POLITICA",
  TICKET_RESERVA: "POLITICA",
  POLITICA_CANCELACION: "POLITICA",
  POLITICA_GARANTIA: "POLITICA",
  GARANTIA_PENDIENTE: "POLITICA",
  GARANTIA_SOLICITUD: "POLITICA",
  GARANTIA_CADUCADA: "POLITICA",
  RECORDATORIO: "POLITICA",
  SOLICITUD_VALORACION: "POLITICA",
};

export const RESERVA_EMAIL_TIPO_LABELS: Record<ReservaEmailTipo, string> = {
  CONFIRMADA: "Reserva confirmada",
  RECONFIRMADA: "Reserva reconfirmada",
  NO_RECONFIRMADA: "Pendiente de reconfirmar",
  LISTA_ESPERA: "En lista de espera",
  LIBERADA: "Mesa liberada",
  TERMINANDO: "Terminando",
  NO_SHOW: "No presentado",
  CANCELADA: "Reserva cancelada",
  TICKET_COMPRA: "Compra de ticket",
  TICKET_RESERVA: "Reserva con ticket",
  POLITICA_CANCELACION: "Política de cancelación",
  POLITICA_GARANTIA: "Política de garantía",
  GARANTIA_PENDIENTE: "Garantía pendiente",
  GARANTIA_SOLICITUD: "Solicitud de tarjeta",
  GARANTIA_CADUCADA: "Cancelada sin tarjeta",
  RECORDATORIO: "Recordatorio de la visita",
  SOLICITUD_VALORACION: "Solicitud de valoración",
};

/**
 * Estados TRANSITORIOS: la reserva pasa por ellos de camino a otra cosa y el
 * cliente no tiene nada que hacer al recibirlos. Su correo es un aviso seco de
 * "tu reserva ha cambiado de estado", sin instrucciones ni bloques extra.
 *
 * El resto son estados con sustancia (confirmada, cancelada, no presentado…):
 * ahí el correo sí explica qué significa y qué puede hacer el cliente.
 */
export const RESERVA_EMAIL_ESTADO_TRANSITORIO: Record<ReservaEmailTipoEstado, boolean> = {
  CONFIRMADA: false,
  RECONFIRMADA: false,
  NO_RECONFIRMADA: true,
  LISTA_ESPERA: true,
  LIBERADA: true,
  TERMINANDO: true,
  NO_SHOW: false,
  CANCELADA: false,
};

export const RESERVA_EMAIL_TIPO_DESCRIPCION: Record<ReservaEmailTipo, string> = {
  CONFIRMADA:
    "Se envía al crear la reserva o al pasarla a confirmada, si el cliente dejó su correo.",
  RECONFIRMADA:
    "Se envía cuando el cliente confirma que mantiene la reserva y esta pasa a reconfirmada.",
  NO_RECONFIRMADA:
    "Se envía cuando la reserva queda pendiente de reconfirmar. Aviso de cambio de estado.",
  LISTA_ESPERA:
    "Se envía cuando la reserva entra en lista de espera. Aviso de cambio de estado.",
  LIBERADA:
    "Se envía cuando la mesa queda liberada tras la visita. Aviso de cambio de estado.",
  TERMINANDO:
    "Se envía cuando la mesa entra en la fase final del servicio. Aviso de cambio de estado.",
  NO_SHOW:
    "Se envía cuando la reserva se marca como no presentada porque el cliente no acudió.",
  CANCELADA: "Se envía cuando la reserva pasa al estado cancelada.",
  TICKET_COMPRA:
    "Se envía al completarse el pago de un producto Ticket, antes de que exista reserva.",
  TICKET_RESERVA:
    "Se envía al crear la reserva asociada a un Ticket ya comprado.",
  POLITICA_CANCELACION:
    "Se envía cuando la reserva queda sujeta a la política de cancelación, con el plazo y el importe.",
  POLITICA_GARANTIA:
    "Se envía cuando la reserva queda sujeta a la política de garantía, con el importe retenido.",
  GARANTIA_PENDIENTE:
    "Se envía al reservar con mucha antelación: confirma la mesa y avisa de que la tarjeta se pedirá unos días antes.",
  GARANTIA_SOLICITUD:
    "Se envía los días antes que indiques, con el enlace para poner la tarjeta y el plazo que tiene el cliente.",
  GARANTIA_CADUCADA:
    "Se envía si el cliente no pone la tarjeta a tiempo y la reserva se cancela.",
  RECORDATORIO:
    "Se envía las horas antes de la reserva que indiques. Recordatorio de cortesía.",
  SOLICITUD_VALORACION:
    "Se envía las horas después de la reserva que indiques. Pide al cliente que puntúe la visita; su nota aparece en su ficha de cliente.",
};

export interface ReservaEmailPlantillaSeed {
  tipo: ReservaEmailTipo;
  asunto_default: string;
  mensaje_default: string;
}

/**
 * Textos de fábrica.
 *
 * Norma: ni un teléfono ni una dirección de correo dentro del cuerpo. El
 * cliente que necesite hablar con el restaurante tiene el enlace de gestión de
 * su reserva; publicar un contacto aquí convierte cada correo en un buzón que
 * nadie atiende.
 */
export const RESERVA_EMAIL_PLANTILLAS_SEED: ReservaEmailPlantillaSeed[] = [
  // ── Estados ──────────────────────────────────────────────────────────────
  {
    tipo: "CONFIRMADA",
    asunto_default: "Reserva confirmada · {{fecha}} {{hora}} · {{empresa}}",
    mensaje_default: "",
  },
  {
    tipo: "RECONFIRMADA",
    asunto_default: "Reserva reconfirmada · {{fecha}} {{hora}} · {{empresa}}",
    mensaje_default:
      "Gracias por confirmarnos que vienes. Tu mesa queda reservada tal y como la ves aquí abajo.",
  },
  {
    tipo: "NO_RECONFIRMADA",
    asunto_default: "Tu reserva del {{fecha}} está pendiente de confirmar",
    mensaje_default:
      "Tu reserva ha pasado a estar pendiente de confirmar. Sigue en pie con los datos que ves aquí abajo.",
  },
  {
    tipo: "LISTA_ESPERA",
    asunto_default: "Tu reserva del {{fecha}} está en lista de espera",
    mensaje_default:
      "Tu reserva ha pasado a lista de espera. Te escribiremos en cuanto tengamos una mesa para ti.",
  },
  {
    tipo: "LIBERADA",
    asunto_default: "Tu reserva del {{fecha}} se ha cerrado",
    mensaje_default:
      "Tu reserva ha pasado a cerrada: la mesa ya está libre. Gracias por tu visita.",
  },
  {
    tipo: "TERMINANDO",
    asunto_default: "Tu reserva del {{fecha}} está terminando",
    mensaje_default:
      "Tu reserva ha pasado al estado terminando. No tienes que hacer nada.",
  },
  {
    tipo: "NO_SHOW",
    asunto_default: "No pudimos atenderte el {{fecha}} · {{empresa}}",
    mensaje_default:
      "Te esperábamos y no llegaste a venir, así que hemos marcado la reserva como no presentada. Si crees que ha sido un error, avísanos y lo revisamos.",
  },
  {
    tipo: "CANCELADA",
    asunto_default: "Reserva cancelada · {{fecha}} {{hora}} · {{empresa}}",
    mensaje_default:
      "Hemos cancelado tu reserva. Si crees que es un error, avísanos y lo revisamos.",
  },

  // ── Políticas y procesos ─────────────────────────────────────────────────
  {
    tipo: "TICKET_COMPRA",
    asunto_default: "Compra confirmada · {{empresa}}",
    // El subtítulo del correo ya dice que el pago ha entrado: aquí se explica lo
    // único que le queda por hacer al cliente, que es elegir día.
    mensaje_default:
      "Guarda este correo: es tu comprobante y lleva el código que necesitas para reservar mesa.",
  },
  {
    tipo: "TICKET_RESERVA",
    asunto_default: "Reserva confirmada con tu ticket · {{fecha}} {{hora}}",
    mensaje_default:
      "Tu ticket ya tiene fecha y hora. Estos son los datos de tu reserva.",
  },
  {
    tipo: "POLITICA_CANCELACION",
    asunto_default: "Condiciones de cancelación de tu reserva · {{fecha}}",
    mensaje_default:
      "Tu reserva está sujeta a nuestra política de cancelación. Te resumimos las condiciones para que las tengas por escrito.",
  },
  {
    tipo: "POLITICA_GARANTIA",
    asunto_default: "Garantía de tu reserva · {{fecha}} {{hora}}",
    mensaje_default:
      "Para asegurar tu mesa hemos retenido un importe en garantía. Te resumimos las condiciones para que las tengas por escrito.",
  },
  {
    tipo: "GARANTIA_PENDIENTE",
    asunto_default: "Reserva confirmada · {{fecha}} {{hora}} · {{empresa}}",
    mensaje_default:
      "Tu reserva está confirmada. Unos días antes te pediremos una tarjeta en garantía; te avisaremos por correo, así que estate atento.",
  },
  {
    tipo: "GARANTIA_SOLICITUD",
    asunto_default: "Necesitamos tu tarjeta para tu reserva del {{fecha}}",
    mensaje_default:
      "Para mantener tu mesa necesitamos una tarjeta en garantía. No te cobramos nada ahora: el importe se libera cuando te presentes.",
  },
  {
    tipo: "GARANTIA_CADUCADA",
    asunto_default: "Tu reserva del {{fecha}} se ha cancelado",
    mensaje_default:
      "No hemos recibido la tarjeta a tiempo, así que hemos liberado la mesa. Si quieres volver a reservar, estaremos encantados de atenderte.",
  },
  {
    tipo: "RECORDATORIO",
    asunto_default: "Te esperamos hoy a las {{hora}} · {{empresa}}",
    mensaje_default: "Hoy es el día. Te recordamos los detalles de tu reserva.",
  },
  {
    tipo: "SOLICITUD_VALORACION",
    asunto_default: "¿Qué tal fue tu visita a {{empresa}}?",
    mensaje_default: "Nos ayudaría mucho saber qué te pareció.",
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

/** true si el tipo es uno de los correos por estado. */
export function esTipoEstado(tipo: ReservaEmailTipo): tipo is ReservaEmailTipoEstado {
  return RESERVA_EMAIL_TIPO_FAMILIA[tipo] === "ESTADO";
}
