import "server-only";
import {
  envolverEmail,
  escapeHtml,
  fila,
  primerNombre,
  type MarcaEmpresa,
} from "@/lib/email/reservas/estilo";

/**
 * La cita se ha anulado (PRP-088).
 *
 * Va en rojo a propósito (`badgeAviso`): con el color de la casa se leía igual
 * que una confirmación y la persona no distinguía de un vistazo que su cita ya
 * no está. Es la misma razón por la que los correos de reserva cancelada de
 * Sala llevan el distintivo en rojo.
 */

export interface CitaAnuladaInput {
  empresa: MarcaEmpresa & { telefono?: string | null };
  calendario: string;
  clienteNombre: string;
  fechaLarga: string;
  hora: string;
  ciudadZona: string;
  /** true = la anuló la propia persona; false = la anuló el equipo. */
  loAnuloElCliente: boolean;
}

export function citaAnuladaEmail(input: CitaAnuladaInput): {
  subject: string;
  html: string;
  text: string;
} {
  const nombre = primerNombre(input.clienteNombre);
  const saludo = nombre ? `Hola, ${escapeHtml(nombre)}.` : "Hola.";

  const entradilla = input.loAnuloElCliente
    ? "Hemos anulado tu cita, como pediste. Esta era:"
    : "Hemos tenido que anular tu cita. Esta era:";

  const tarjeta = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid #e2e8f0;border-radius:12px;">
    <tr><td style="padding:16px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${fila("Día", input.fechaLarga)}
        ${fila("Hora", `${input.hora} (hora de ${input.ciudadZona})`)}
      </table>
    </td></tr>
  </table>`;

  const html = envolverEmail({
    empresa: input.empresa,
    badge: "Cita anulada",
    badgeAviso: true,
    titular: "Tu cita ya no está",
    subtitulo: input.calendario,
    telefono: input.empresa.telefono ?? null,
    pie: "Si quieres otro día, dínoslo y te buscamos hueco.",
    contenido: `
      <p style="margin:0 0 16px 0;font-size:15px;color:#0f172a;line-height:1.6;">
        ${saludo} ${entradilla}
      </p>
      ${tarjeta}
      <p style="margin:18px 0 0 0;font-size:13px;color:#64748b;line-height:1.6;">
        También la hemos quitado de tu calendario.
      </p>
    `,
  });

  const text = [
    nombre ? `Hola, ${nombre}.` : "Hola.",
    "",
    input.loAnuloElCliente
      ? `Hemos anulado tu cita, como pediste: ${input.calendario}.`
      : `Hemos tenido que anular tu cita: ${input.calendario}.`,
    `Era el ${input.fechaLarga} a las ${input.hora} (hora de ${input.ciudadZona}).`,
    "",
    "Si quieres otro día, dínoslo y te buscamos hueco.",
    input.empresa.nombre,
  ].join("\n");

  return { subject: `Cita anulada · ${input.fechaLarga}, ${input.hora}`, html, text };
}
