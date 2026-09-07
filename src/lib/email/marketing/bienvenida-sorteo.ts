/**
 * El correo que recibe quien deja sus datos en la web para el sorteo del mes.
 *
 * Sale en el momento, y no es un detalle de cortesía: quien acaba de escribir su
 * teléfono y su fecha de nacimiento en una web tiene derecho a saber ya mismo
 * dónde ha ido eso a parar. El correo le dice tres cosas —que está dentro, que
 * recibirá uno al mes y cómo se gana— y le deja el enlace para darse de baja.
 *
 * Va por `sendEmail`, el mismo camino que los correos de reserva, y no por la
 * API de campañas: es un correo para una persona y tiene que salir en el
 * segundo, no en la cola del envío masivo.
 *
 * SÍ lleva enlace de baja, al contrario que el correo de premio: aquí se está
 * dando de alta en una lista de publicidad, y la ley pide que la puerta de
 * salida esté en el mismo sitio que la de entrada.
 */
import "server-only";
import { sendEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  envolverEmail,
  escapeHtml,
  type MarcaEmpresa,
} from "@/lib/email/reservas/estilo";
import {
  PLAZAS_SORTEO,
  premioMensualDe,
} from "@/features/marketing/data/premio-mensual";

export async function enviarBienvenidaSorteo(input: {
  empresaId: string;
  email: string;
  nombre?: string | null;
  /** Enlace para darse de baja. Si falta, el correo no sale. */
  urlBaja: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("empresas")
    .select("nombre, logo_url, isotipo_url, color, color_secundario, telefono")
    .eq("id", input.empresaId)
    .maybeSingle();
  if (!data) return;

  const empresa: MarcaEmpresa = {
    nombre: (data.nombre as string) ?? "",
    logo_url: (data.logo_url as string | null) ?? null,
    isotipo_url: (data.isotipo_url as string | null) ?? null,
    color: (data.color as string | null) ?? null,
    color_secundario: (data.color_secundario as string | null) ?? null,
  };
  const premio = premioMensualDe(empresa.nombre);
  const nombrePila = input.nombre?.trim().split(" ")[0] ?? "";

  const contenido = `
    <p style="margin:0 0 14px 0;font-size:16px;line-height:1.6;color:#0f172a;">
      ${nombrePila ? `${escapeHtml(nombrePila)}, ya` : "Ya"} estás dentro. Cada mes
      sorteamos ${escapeHtml(premio.plural)} entre quienes recibís este correo, y
      desde hoy eres uno de ellos.
    </p>

    <p style="margin:0 0 8px 0;font-size:14px;font-weight:600;color:#0f172a;">
      Cómo funciona
    </p>
    <ul style="margin:0 0 16px 0;padding-left:20px;font-size:14px;line-height:1.7;color:#475569;">
      <li>Un día al azar de cada mes te llega un correo nuestro. No decimos cuál:
          esa es toda la gracia.</li>
      <li>Dentro hay cinco preguntas sobre la casa. Se contestan en un minuto.</li>
      <li>${PLAZAS_SORTEO === 3 ? "Los tres primeros" : `Los ${PLAZAS_SORTEO} primeros`}
          que acierten las cinco se llevan ${escapeHtml(premio.singular)}.</li>
      <li>Si aciertas y llegas a tiempo, te mandamos el código en el momento. Lo
          enseñas al llegar y ya está.</li>
    </ul>

    <p style="margin:0 0 12px 0;font-size:13px;line-height:1.6;color:#64748b;">
      Un correo al mes, nada más. Si algún mes no te apetece jugar, no pasa nada:
      no hace falta hacer nada para seguir dentro del siguiente.
    </p>
    ${
      input.urlBaja
        ? `<p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
             Si prefieres no recibirlos,
             <a href="${input.urlBaja}" style="color:#94a3b8;">darte de baja aquí</a>.
             Se aplica al momento y no vuelves a saber de nosotros.
           </p>`
        : ""
    }`;

  await sendEmail({
    to: input.email,
    subject: `Estás dentro del sorteo de ${empresa.nombre}`,
    html: envolverEmail({
      empresa,
      badge: "Sorteo del mes",
      titular: "Ya participas",
      subtitulo: `Cada mes, ${premio.plural} a repartir`,
      contenido,
      pie: "Te escribimos una vez al mes",
      telefono: (data.telefono as string | null) ?? null,
    }),
    // La cabecera de marca la pone ya `envolverEmail`: sin esto saldrían dos.
    empresaId: input.empresaId,
    brandHeader: false,
  });
}
