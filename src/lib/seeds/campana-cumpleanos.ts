/**
 * Seed canónico de la CAMPAÑA DE CUMPLEAÑOS.
 *
 * Es la única campaña que no sale un día señalado del calendario, sino el día
 * señalado de cada cliente. De ahí que viva aparte del calendario anual: aquel
 * manda doce correos al año a todo el mundo; esta manda dos al año a cada uno,
 * los suyos.
 *
 * ── Dos momentos, y cada uno hace una sola cosa ────────────────────────────
 *
 *   **Diez días antes — el aviso.** Misterioso a propósito: no nombra la fecha,
 *   la insinúa. Lleva el 10% con su código personal y, entre paréntesis, lo que
 *   de verdad llena una mesa: si viene con diez amigos, lo suyo lo invita la
 *   casa. Diez días y no tres porque juntar a once personas se decide con
 *   tiempo.
 *
 *   **El día — la felicitación.** No vende NADA. Ni código, ni mesa, ni oferta:
 *   solo felicidades y el botón de la web. Un cliente distingue perfectamente
 *   una felicitación de un anuncio disfrazado de felicitación, y la segunda
 *   quema la marca el día que peor sienta.
 *
 * Que sean dos correos y no uno es deliberado: mezclarlos convertiría la
 * felicitación en el envoltorio de una promoción.
 *
 * ── Por qué el regalo va con cupón personal ────────────────────────────────
 * "Ven gratis por tu cumple" sin código es una promesa que hay que discutir en
 * la puerta. Con código, la reserva llega a sala con el cupón pegado y el
 * camarero lo ve al cerrar la cuenta. Cada cupón es de un solo uso y lleva el
 * nombre de su dueño: reenviárselo a un amigo no multiplica el regalo.
 *
 * ── Los tres canales ───────────────────────────────────────────────────────
 * El aviso tiene texto escrito para cada canal —el correo se lee sentado, el SMS
 * se lee de pie—, pero a cada persona le llega UNA sola vez, por el canal más
 * directo que tenga permiso: WhatsApp, si no SMS, si no correo. La felicitación
 * va solo por correo: es la que no pide nada a cambio y no merece gastar el
 * canal caro.
 */

export interface TextoEmailCumpleanos {
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
}

export interface CampanaCumpleanosSeed {
  /** Identificador estable del aviso. No cambiar: evita duplicar la campaña. */
  clave: "CUMPLEANOS";
  /** Identificador estable de la felicitación del día. */
  claveFelicitacion: "CUMPLEANOS_FELICITACION";
  /** Días de antelación del aviso. */
  diasAntes: number;
  /**
   * Días que el cupón sigue valiendo DESPUÉS del cumpleaños.
   *
   * Diez, y el correo enseña la fecha límite pero NO dice de dónde sale: el
   * aviso nunca nombra el cumpleaños, así que tampoco puede decir "tu cumple más
   * diez". Se ve una fecha y punto.
   */
  diasValidezDespues: number;
  /** Descuento que lleva el cupón, en porcentaje. */
  descuentoPorcentaje: number;
  /**
   * Amigos que hay que traer para que la casa invite al cumpleañero. La mesa
   * son estos MÁS la persona que cumple.
   *
   * Diez amigos, mesa de once, y ahí está toda la gracia de la mecánica: una
   * parte de once es el 9% de la cuenta, así que el 10% que lleva el cupón
   * cubre justo lo suyo —y sobra un poco—. No son dos ofertas, es una contada
   * de dos maneras: el porcentaje para quien viene en pareja, y "tú no pagas"
   * para quien llena la mesa, que es la que se entiende sin pensar.
   */
  amigosParaGratis: number;
  /**
   * Palabra clave del enlace de reserva. Es `EMAIL` y no `CUMPLEANOS` a
   * propósito: la palabra clave se graba en `reservas.origen`, y un enlace por
   * campaña partiría el canal del correo en tantas columnas como campañas haya.
   * En Sala interesa "cuántas mesas llegaron por correo"; qué campaña concreta
   * las trajo se mide en Marketing, con sus envíos y sus clics.
   */
  palabraClave: string;

  aviso: TextoEmailCumpleanos;
  felicitacion: TextoEmailCumpleanos;

  sms: {
    nombre: string;
    /** Sin tildes ni eñes a propósito: ver la nota de GSM-7 más abajo. */
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
 * Se dejan escritos en el texto guardado —y no resueltos al sembrar— porque la
 * campaña es editable: el restaurante puede reescribir el correo y los
 * marcadores tienen que seguir funcionando después.
 */
export const MARCADORES_CUMPLEANOS = {
  nombre: "{{NOMBRE}}",
  empresa: "{{EMPRESA}}",
  codigo: "{{CODIGO}}",
  caducidad: "{{CADUCIDAD}}",
  descuento: "{{DESCUENTO}}",
  amigos: "{{AMIGOS}}",
  mesa: "{{MESA}}",
  url: "{{URL}}",
} as const;

export const CAMPANA_CUMPLEANOS_SEED: CampanaCumpleanosSeed = {
  clave: "CUMPLEANOS",
  claveFelicitacion: "CUMPLEANOS_FELICITACION",
  diasAntes: 10,
  diasValidezDespues: 10,
  descuentoPorcentaje: 10,
  // Diez amigos + quien cumple = once a la mesa, y ella no paga.
  amigosParaGratis: 10,
  palabraClave: "EMAIL",

  // ── Diez días antes ──────────────────────────────────────────────────────
  aviso: {
    nombre: "Cumpleaños · Aviso 10 días antes",
    // El asunto no dice "cumpleaños": si lo dijera, se lee entero en la bandeja
    // y ya no hay nada que abrir.
    asunto: "Nos hemos acordado de una fecha",
    preheader: "Un 10% de descuento por tu cumpleaños. Y si vienes con diez, no pagas nada.",
    badge: "Falta poco",
    titular: "Hay una fecha tuya marcada en nuestro calendario",
    subtitulo: "Y viene con un 10% de descuento",
    entradilla:
      "No hace falta que nos digas cuál es, {{NOMBRE}}: ya la tenemos apuntada. Por tu cumpleaños te damos un {{DESCUENTO}}% de descuento en tu mesa.",
    cuerpo: [
      "Tienes tres semanas para gastarlo: desde hoy —diez días antes— hasta diez días después de tu cumpleaños. El código lleva tu nombre y solo vale una vez.",
      "Y si te presentas con {{AMIGOS}} amigos, ese {{DESCUENTO}}% eres tú: lo tuyo lo pagamos nosotros.",
    ],
    ctaTexto: "Reservar mi mesa",
    fotoPistas: ["tarta", "postre", "chuletón", "chuleton", "solomillo", "arroz"],
  },

  // ── El día ───────────────────────────────────────────────────────────────
  felicitacion: {
    nombre: "Cumpleaños · Felicitación del día",
    asunto: "¡Felicidades, {{NOMBRE}}!",
    preheader: "Nada que vender. Solo felicitarte.",
    badge: "Hoy",
    titular: "¡Felicidades, {{NOMBRE}}!",
    subtitulo: "Que lo celebres como te dé la gana",
    entradilla:
      "Hoy es tu día y no venimos a pedirte nada: solo a desearte que lo pases muy bien.",
    cuerpo: [
      "Un abrazo grande de todo el equipo de {{EMPRESA}}. Estés donde estés, que la mesa se llene de gente que te quiere.",
    ],
    ctaTexto: "Visitar nuestra web",
    // Sin fotos de plato: una foto de comida en la felicitación la convierte en
    // un anuncio, que es justo lo que este correo no es.
    fotoPistas: [],
  },

  sms: {
    nombre: "Cumpleaños · SMS",
    // Sin tildes ni eñes: el alfabeto GSM-7 no las lleva, y una sola vocal
    // acentuada obliga a codificar el mensaje entero en UCS-2, que baja el tope
    // de 160 a 70 caracteres y parte el aviso en dos SMS cobrados aparte.
    cuerpo:
      // Apretado a conciencia: con el nombre, el codigo, la fecha y el enlace
      // reales esto queda en ~150 caracteres. Pasar de 160 lo parte en dos SMS
      // y duplica el coste de cada felicitacion.
      "{{NOMBRE}}: por tu cumple, {{DESCUENTO}}% en {{EMPRESA}}. Codigo {{CODIGO}} hasta el {{CADUCIDAD}}. Con {{AMIGOS}} amigos no pagas nada. {{URL}}",
  },

  whatsapp: {
    nombre: "Cumpleaños · WhatsApp",
    plantilla: "cumpleanos_invitacion",
    idioma: "es",
    cuerpo:
      "{{NOMBRE}}, por tu cumpleaños te damos un {{DESCUENTO}}% de descuento en {{EMPRESA}}. Tu código es {{CODIGO}} y puedes gastarlo hasta el {{CADUCIDAD}}, diez días después de tu cumpleaños. Y si te presentas con {{AMIGOS}} amigos, ese {{DESCUENTO}}% eres tú: lo tuyo lo pagamos nosotros. Reserva aquí: {{URL}}",
  },
};
