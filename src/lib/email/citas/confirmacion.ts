import "server-only";
import {
  boton,
  envolverEmail,
  escapeHtml,
  fila,
  primerNombre,
  type MarcaEmpresa,
} from "@/lib/email/reservas/estilo";

/**
 * Confirmación de una cita reservada desde un embudo (PRP-088).
 *
 * Hasta ahora el único aviso que recibía quien reservaba era el que manda
 * Google al invitarle al evento: sin la marca de la empresa y, si Google
 * fallaba, la persona se quedaba sin nada aunque su cita estuviera guardada.
 * Google es el espejo, no la fuente: la confirmación la manda el software.
 *
 * Mismo marco visual que los correos de Sala (`reservas/estilo`), para que
 * todo lo que sale del software se vea igual.
 */

export interface CitaConfirmacionInput {
  empresa: MarcaEmpresa & { telefono?: string | null };
  /** Nombre del calendario: "Llamada de valoración", "Clase gratuita"… */
  calendario: string;
  clienteNombre: string;
  /** Ya formateada en la zona de la empresa: "lunes, 15 de septiembre de 2026". */
  fechaLarga: string;
  /** "HH:MM" en la zona de la empresa. */
  hora: string;
  duracionMin: number;
  /** Cómo se llama la ciudad de la zona horaria: "Madrid". Para que nadie se líe. */
  ciudadZona: string;
  /** Con quién es la reunión. */
  conQuien?: string | null;
  /** Enlace de la videollamada, si Google llegó a crearla. */
  meetUrl?: string | null;
}

function duracionLegible(min: number): string {
  if (min < 60) return `${min} minutos`;
  const horas = Math.floor(min / 60);
  const resto = min % 60;
  const h = horas === 1 ? "1 hora" : `${horas} horas`;
  return resto ? `${h} y ${resto} minutos` : h;
}

export function citaConfirmacionEmail(input: CitaConfirmacionInput): {
  subject: string;
  html: string;
  text: string;
} {
  const nombre = primerNombre(input.clienteNombre);
  const saludo = nombre ? `Hola, ${escapeHtml(nombre)}.` : "Hola.";

  const filas = [
    fila("Día", input.fechaLarga),
    fila("Hora", `${input.hora} (hora de ${input.ciudadZona})`),
    fila("Duración", duracionLegible(input.duracionMin)),
    input.conQuien ? fila("Con", input.conQuien) : "",
  ].join("");

  const tarjeta = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid #e2e8f0;border-radius:12px;">
    <tr><td style="padding:16px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas}</table>
    </td></tr>
  </table>`;

  // Sin enlace de videollamada no se promete una: el correo dice la verdad de
  // lo que hay, y quien atiende se pondrá en contacto.
  const acceso = input.meetUrl
    ? boton("Entrar a la videollamada", input.meetUrl, input.empresa.color) +
      `<p style="margin:10px 0 0 0;font-size:12px;color:#94a3b8;text-align:center;">El mismo enlace sirve el día de la cita. Guarda este correo.</p>`
    : `<p style="margin:16px 0 0 0;font-size:13px;color:#64748b;text-align:center;">Te enviaremos el enlace de la videollamada antes de la cita.</p>`;

  const html = envolverEmail({
    empresa: input.empresa,
    badge: "Cita confirmada",
    titular: "Tu cita está reservada",
    subtitulo: input.calendario,
    telefono: input.empresa.telefono ?? null,
    pie: "Si no puedes venir, avísanos con tiempo y buscamos otro hueco.",
    contenido: `
      <p style="margin:0 0 16px 0;font-size:15px;color:#0f172a;line-height:1.6;">
        ${saludo} Hemos apuntado tu cita. Aquí tienes los datos:
      </p>
      ${tarjeta}
      ${acceso}
      <p style="margin:18px 0 0 0;font-size:13px;color:#64748b;line-height:1.6;">
        Te adjuntamos la cita para que la añadas a tu calendario.
      </p>
    `,
  });

  const text = [
    nombre ? `Hola, ${nombre}.` : "Hola.",
    "",
    `Tu cita está reservada: ${input.calendario}.`,
    `Día: ${input.fechaLarga}`,
    `Hora: ${input.hora} (hora de ${input.ciudadZona})`,
    `Duración: ${duracionLegible(input.duracionMin)}`,
    input.conQuien ? `Con: ${input.conQuien}` : "",
    input.meetUrl ? `Videollamada: ${input.meetUrl}` : "",
    "",
    "Si no puedes venir, avísanos con tiempo y buscamos otro hueco.",
    input.empresa.nombre,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: `Cita confirmada · ${input.fechaLarga}, ${input.hora}`,
    html,
    text,
  };
}
