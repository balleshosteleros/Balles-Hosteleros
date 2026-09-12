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
 * Las horas van en UTC (sufijo Z). Es lo único que interpretan igual todos los
 * programas sin arrastrar la definición de la zona horaria dentro del archivo.
 */

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

export function construirIcs(input: IcsInput): string {
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Balles Hosteleros//Citas//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${aFormatoIcs(new Date().toISOString())}`,
    `DTSTART:${aFormatoIcs(input.inicioISO)}`,
    `DTEND:${aFormatoIcs(input.finISO)}`,
    `SUMMARY:${escapar(input.titulo)}`,
    input.descripcion ? `DESCRIPTION:${escapar(input.descripcion)}` : "",
    input.url ? `LOCATION:${escapar(input.url)}` : "",
    input.url ? `URL:${escapar(input.url)}` : "",
    "STATUS:CONFIRMED",
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
