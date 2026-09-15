import "server-only";

/**
 * Archivo de calendario (.ics) que se adjunta al correo de confirmación de una
 * cita (PRP-088).
 *
 * Antes la cita aparecía sola en el calendario de quien reservaba porque Google
 * le mandaba la invitación. Ahora la confirmación la manda el software, así que
 * hay que darle la cita en un formato que entiendan Google Calendar, Outlook y
 * el calendario del iPhone: eso es un .ics.
 *
 * OJO CON EL `METHOD`, que es lo que decide si la cita se añade sola:
 *   · `REQUEST` = invitación. Gmail la enseña como tarjeta dentro del correo y
 *     la mete en el calendario. Exige ORGANIZER y ATTENDEE.
 *   · `PUBLISH` = archivo suelto. Llega como adjunto y hay que abrirlo a mano.
 * Se mandó `PUBLISH` y la gente veía un archivo que no se añadía a ningún sitio.
 *
 * Las horas van en UTC (sufijo Z). Es lo único que interpretan igual todos los
 * programas sin arrastrar la definición de la zona horaria dentro del archivo.
 */

export interface PersonaIcs {
  nombre?: string | null;
  email: string;
}

export interface IcsInput {
  uid: string;
  /** Instante de inicio en ISO (UTC). */
  inicioISO: string;
  /** Instante de fin en ISO (UTC). */
  finISO: string;
  titulo: string;
  descripcion?: string | null;
  /** Enlace de la videollamada: va como sitio de la cita. */
  url?: string | null;
  /** `REQUEST` para que se añada sola; `PUBLISH` para un archivo suelto. */
  metodo?: "REQUEST" | "PUBLISH" | "CANCEL";
  /** Quién convoca. Obligatorio en una invitación. */
  organizador?: PersonaIcs | null;
  /** A quién se convoca. Obligatorio en una invitación. */
  asistente?: PersonaIcs | null;
  /**
   * Sube de uno en uno cada vez que la cita cambia. Sin esto, el calendario de
   * quien reserva se queda con la versión vieja e ignora la corrección.
   */
  secuencia?: number;
}

/** 2026-09-15T08:00:00.000Z → 20260915T080000Z */
function aFormatoIcs(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** En un .ics la coma, el punto y coma y la barra invertida van escapados. */
function escapar(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** `ORGANIZER;CN=Nombre:mailto:correo` (y lo mismo para el asistente). */
function lineaPersona(campo: "ORGANIZER" | "ATTENDEE", p: PersonaIcs): string {
  const cn = p.nombre?.trim() ? `;CN=${escapar(p.nombre.trim())}` : "";
  const extra =
    campo === "ATTENDEE" ? ";ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE" : "";
  return `${campo}${cn}${extra}:mailto:${p.email.trim()}`;
}

export function construirIcs(input: IcsInput): string {
  const metodo = input.metodo ?? "PUBLISH";
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Balles Hosteleros//Citas//ES",
    "CALSCALE:GREGORIAN",
    `METHOD:${metodo}`,
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `SEQUENCE:${input.secuencia ?? 0}`,
    `DTSTAMP:${aFormatoIcs(new Date().toISOString())}`,
    `DTSTART:${aFormatoIcs(input.inicioISO)}`,
    `DTEND:${aFormatoIcs(input.finISO)}`,
    `SUMMARY:${escapar(input.titulo)}`,
    input.organizador ? lineaPersona("ORGANIZER", input.organizador) : "",
    input.asistente ? lineaPersona("ATTENDEE", input.asistente) : "",
    input.descripcion ? `DESCRIPTION:${escapar(input.descripcion)}` : "",
    input.url ? `LOCATION:${escapar(input.url)}` : "",
    input.url ? `URL:${escapar(input.url)}` : "",
    metodo === "CANCEL" ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
    // Aviso 30 minutos antes: la cita es por vídeo y sin recordatorio se olvida.
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapar(input.titulo)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  // Los saltos de línea de un .ics son CRLF: Outlook rechaza el archivo sin ellos.
  return lineas.join("\r\n");
}
