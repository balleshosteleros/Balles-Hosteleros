/**
 * Seed canónico de la CAMPAÑA DE CUMPLEAÑOS.
 *
 * Es la única campaña que no sale un día señalado del calendario, sino el día
 * señalado de cada cliente. De ahí que viva aparte del calendario anual: aquel
 * manda doce correos al año a todo el mundo; este manda uno al año a cada uno,
 * el suyo.
 *
 * ── Por qué se manda SIETE DÍAS ANTES ──────────────────────────────────────
 * El regalo exige juntar a seis personas. Avisar la mañana del cumpleaños es
 * regalar algo que no se puede usar: nadie llena una mesa de seis en unas horas,
 * y encima ese día la gente ya tiene plan. Una semana antes llega cuando el plan
 * todavía se está decidiendo, que es justo donde queremos estar.
 *
 * ── Por qué el regalo va con cupón personal ────────────────────────────────
 * "Ven gratis por tu cumple" sin código es una promesa que hay que discutir en
 * la puerta. Con código, el software ya sabe al reservar si la mesa cumple el
 * mínimo, la reserva llega a sala con el cupón pegado y el camarero lo ve al
 * cerrar la cuenta. Cada cupón es de un solo uso y lleva el nombre de su dueño:
 * reenviárselo a un amigo no multiplica el regalo.
 *
 * ── Los tres canales ───────────────────────────────────────────────────────
 * Cada canal tiene su texto escrito para él —el correo se lee sentado, el SMS
 * se lee de pie— pero a cada persona le llega UNA sola felicitación, por el
 * canal más directo que tenga permiso: WhatsApp, si no SMS, si no correo. Tres
 * mensajes iguales el mismo día no son tres oportunidades, son una queja.
 */

export interface CampanaCumpleanosSeed {
  /** Identificador estable. No cambiar: es lo que evita duplicar la campaña. */
  clave: "CUMPLEANOS";
  /** Días de antelación con los que sale la felicitación. */
  diasAntes: number;
  /** Días que el cupón sigue valiendo DESPUÉS del cumpleaños. */
  diasValidezDespues: number;
  /** Comensales mínimos, contando al cumpleañero. */
  minimoPersonas: number;
  /** Palabra clave del enlace de reserva, para atribuir las mesas. */
  palabraClave: string;
  email: {
    nombre: string;
    asunto: string;
    preheader: string;
    badge: string;
    titular: string;
    subtitulo: string;
    entradilla: string;
    cuerpo: string[];
    ctaTexto: string;
    /** Pistas para elegir la foto en la carta de cada empresa. */
    fotoPistas: string[];
  };
  sms: {
    nombre: string;
    /** Sin tildes ni eñes a propósito: ver nota de GSM-7 más abajo. */
    cuerpo: string;
  };
  whatsapp: {
    nombre: string;
    /** Nombre de la plantilla aprobada en el WhatsApp Manager de Meta. */
    plantilla: string;
    idioma: string;
    cuerpo: string;
  };
}

/**
 * Marcadores que el motor sustituye persona a persona antes de enviar.
 * Se dejan en el texto guardado —y no resueltos al sembrar— porque la campaña
 * es editable: el restaurante puede reescribir el correo y los marcadores tienen
 * que seguir funcionando después.
 */
export const MARCADORES_CUMPLEANOS = {
  nombre: "{{NOMBRE}}",
  empresa: "{{EMPRESA}}",
  codigo: "{{CODIGO}}",
  caducidad: "{{CADUCIDAD}}",
  minimo: "{{MINIMO}}",
  url: "{{URL}}",
} as const;

export const CAMPANA_CUMPLEANOS_SEED: CampanaCumpleanosSeed = {
  clave: "CUMPLEANOS",
  diasAntes: 7,
  diasValidezDespues: 7,
  minimoPersonas: 6,
  palabraClave: "CUMPLEANOS",

  email: {
    nombre: "Cumpleaños · Invita la casa",
    // 35 caracteres: lo que cabe entero en la bandeja de un móvil.
    asunto: "Tu cumpleaños lo invitamos nosotros",
    preheader: "Ven con cinco y lo tuyo no entra en la cuenta.",
    badge: "Tu cumpleaños",
    titular: "Este año tu cumpleaños lo pagamos nosotros",
    subtitulo: "Reserva mesa para seis y la tuya la invita la casa",
    entradilla:
      "Se acerca tu cumpleaños, {{NOMBRE}}, y aquí lo celebramos como toca: reserva mesa con nosotros, veníos seis y lo tuyo no entra en la cuenta.",
    cuerpo: [
      "No hay menú cerrado ni letra pequeña. Pides lo que te apetezca de la carta y, al cerrar la cuenta, lo tuyo no aparece. El único requisito es que seáis seis a la mesa contándote a ti.",
      "El código de abajo es tuyo y vale una sola vez. Lo escribes al reservar y ya está: el día que vengáis lo tenemos apuntado y no hay nada que explicar en la puerta.",
    ],
    ctaTexto: "Reservar mi cumpleaños",
    fotoPistas: ["tarta", "postre", "chuletón", "chuleton", "solomillo", "arroz"],
  },

  sms: {
    nombre: "Cumpleaños · SMS",
    // Sin tildes ni eñes: el alfabeto GSM-7 no las lleva, y una sola vocal
    // acentuada obliga a codificar el mensaje entero en UCS-2, que baja el tope
    // de 160 a 70 caracteres y parte la felicitacion en dos SMS cobrados aparte.
    cuerpo:
      "{{NOMBRE}}, por tu cumple en {{EMPRESA}} lo tuyo lo invitamos nosotros: reserva mesa de {{MINIMO}}. Codigo {{CODIGO}}, hasta el {{CADUCIDAD}}. {{URL}}",
  },

  whatsapp: {
    nombre: "Cumpleaños · WhatsApp",
    plantilla: "cumpleanos_invitacion",
    idioma: "es",
    cuerpo:
      "¡Felicidades por adelantado, {{NOMBRE}}! En {{EMPRESA}} tu cumpleaños lo invitamos nosotros: reserva mesa para {{MINIMO}} y lo tuyo no entra en la cuenta. Tu código es {{CODIGO}} y vale hasta el {{CADUCIDAD}}. Reserva aquí: {{URL}}",
  },
};
