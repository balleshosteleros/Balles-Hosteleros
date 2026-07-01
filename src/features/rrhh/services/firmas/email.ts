import { sendEmail, type SendEmailResult } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { formatFechaHoraEnZona } from "@/features/empresa/lib/zona-horaria";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://sistema.balleshosteleros.com";

/** Zona horaria de la empresa para fechar correos de firma (PRP-069). */
async function zonaDeEmpresa(empresaId: string): Promise<string> {
  try {
    return await getZonaHorariaEmpresa(createAdminClient(), empresaId);
  } catch {
    return "Europe/Madrid";
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shellHtml(opts: {
  titulo: string;
  cuerpoHtml: string;
  footerEmpresa: string;
}) {
  const fontStack =
    "'Inter','Inter Placeholder',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  // El isotipo de la empresa lo antepone `sendEmail` (empresaId).
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#ffffff;font-family:${fontStack};color:#0f172a;-webkit-font-smoothing:antialiased;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
      <tr><td align="center" style="padding:16px 16px 32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <tr><td style="padding:4px 4px 6px 4px;">
            <h1 style="margin:0;font-size:22px;font-weight:600;color:#0f172a;letter-spacing:-0.015em;line-height:1.25;">${esc(opts.titulo)}</h1>
          </td></tr>
          <tr><td style="padding:14px 4px 24px 4px;font-size:15px;line-height:1.6;color:#334155;">
            ${opts.cuerpoHtml}
          </td></tr>
          <tr><td style="padding:24px 4px 0 4px;border-top:1px solid #e5e7eb;font-size:12px;color:#94a3b8;line-height:1.5;">
            ${esc(opts.footerEmpresa)} · Sistema de firma electrónica
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export type InvitacionFirmaInput = {
  to: string;
  empresaId: string;
  empresaNombre: string;
  empresaLogoUrl?: string | null;
  empleadoNombre: string;
  tituloDocumento: string;
  enviadoPor: string;
  token: string;
  expiraEn: Date;
  /**
   * Personalización opcional del correo (PRP-070). La usan el contrato interno y
   * el oficial para tomar asunto/intro de una plantilla EDITABLE. El botón de
   * firma, el aviso de caducidad y el diseño se mantienen. Si no se pasa, el
   * correo usa los textos estándar (resto de firmas: bajas, etc.).
   */
  asuntoOverride?: string | null;
  /** Párrafo(s) introductorios en texto plano (se renderizan a HTML). */
  introOverride?: string | null;
};

export async function enviarInvitacionFirma(input: InvitacionFirmaInput): Promise<SendEmailResult> {
  const url = `${APP_URL}/firmar/${encodeURIComponent(input.token)}`;
  const tz = await zonaDeEmpresa(input.empresaId);
  const expira = formatFechaHoraEnZona(input.expiraEn.toISOString(), tz);

  // Intro: por defecto el texto estándar; si hay override (plantilla editable),
  // se usan esos párrafos. El bloque del documento + botón de firma se mantiene.
  const introHtml = input.introOverride
    ? input.introOverride.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br/>")}</p>`).join("")
    : `<p>Hola ${esc(input.empleadoNombre)},</p>
       <p>La dirección de ${esc(input.empresaNombre)} te ha enviado un documento para firma electrónica:</p>`;

  const cuerpoHtml = `
    ${introHtml}
    <p style="margin:12px 0;padding:12px 14px;background:#f0fdf4;border-left:3px solid #16a34a;font-weight:500;color:#0f172a;">
      ${esc(input.tituloDocumento)}
    </p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${url}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:10px;font-weight:600;font-size:15px;">
        Firmar documento
      </a>
    </p>
    <p style="font-size:13px;color:#64748b;">El enlace es personal y de un solo uso. Caduca el <strong>${esc(expira)}</strong>.</p>
    <p style="font-size:13px;color:#64748b;">Si no esperabas este correo, ignóralo o contacta con RRHH de ${esc(input.empresaNombre)}.</p>
  `;
  const introText = input.introOverride
    ? `${input.introOverride}\n\n`
    : `Hola ${input.empleadoNombre},\n\n` +
      `La dirección de ${input.empresaNombre} te ha enviado un documento para firma electrónica:\n`;
  const text =
    introText +
    `  ${input.tituloDocumento}\n\n` +
    `Firma aquí: ${url}\n` +
    `Enlace personal y de un solo uso. Caduca el ${expira}.\n`;

  return sendEmail({
    to: input.to,
    subject: input.asuntoOverride?.trim() || `Documento para firmar — ${input.tituloDocumento}`,
    html: shellHtml({
      titulo: input.asuntoOverride?.trim() || "Documento para firmar",
      cuerpoHtml,
      footerEmpresa: input.empresaNombre,
    }),
    text,
    empresaId: input.empresaId,
    // Reply-To siempre no-reply: no se responde al software.
  });
}

export type CodigoOTPInput = {
  to: string;
  empresaId: string;
  empresaNombre: string;
  empresaLogoUrl?: string | null;
  empleadoNombre: string;
  tituloDocumento: string;
  codigo: string;
  expiraMin: number;
};

export async function enviarCodigoOTP(input: CodigoOTPInput): Promise<SendEmailResult> {
  const cuerpoHtml = `
    <p>Hola ${esc(input.empleadoNombre)},</p>
    <p>Para confirmar la firma del documento <strong>${esc(input.tituloDocumento)}</strong> introduce este código en la página de firma:</p>
    <p style="text-align:center;margin:20px 0;">
      <span style="display:inline-block;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:32px;letter-spacing:8px;padding:14px 22px;background:#16a34a;color:#ffffff;border-radius:10px;font-weight:700;">
        ${esc(input.codigo)}
      </span>
    </p>
    <p style="font-size:13px;color:#64748b;">Válido durante ${input.expiraMin} minutos. Si no lo solicitaste, ignora este mensaje.</p>
  `;
  const text =
    `Hola ${input.empleadoNombre},\n\n` +
    `Código de verificación para firmar "${input.tituloDocumento}": ${input.codigo}\n` +
    `Válido ${input.expiraMin} minutos.\n`;

  return sendEmail({
    to: input.to,
    subject: `Código de firma: ${input.codigo}`,
    html: shellHtml({
      titulo: "Código de verificación",
      cuerpoHtml,
      footerEmpresa: input.empresaNombre,
    }),
    text,
    empresaId: input.empresaId,
    // Reply-To siempre no-reply: no se responde al software.
  });
}

export type CopiaFirmadaInput = {
  to: string;
  empresaId: string;
  empresaNombre: string;
  empresaLogoUrl?: string | null;
  empleadoNombre: string;
  tituloDocumento: string;
  firmadoEn: Date;
  signedUrl: string;
};

export async function enviarCopiaFirmada(input: CopiaFirmadaInput): Promise<SendEmailResult> {
  const tz = await zonaDeEmpresa(input.empresaId);
  const firmadoStr = formatFechaHoraEnZona(input.firmadoEn.toISOString(), tz);
  const cuerpoHtml = `
    <p>Hola ${esc(input.empleadoNombre)},</p>
    <p>Has firmado correctamente el documento <strong>${esc(input.tituloDocumento)}</strong> el ${esc(firmadoStr)}.</p>
    <p>Puedes descargar tu copia (documento original + acta de firma):</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${input.signedUrl}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:500;">
        Descargar copia firmada
      </a>
    </p>
    <p style="font-size:13px;color:#64748b;">El enlace de descarga caduca en 7 días. También tendrás este documento siempre disponible en tu portal, en <strong>Mis documentos</strong>.</p>
  `;
  const text =
    `Hola ${input.empleadoNombre},\n\n` +
    `Has firmado correctamente "${input.tituloDocumento}" el ${firmadoStr}.\n` +
    `Descarga tu copia: ${input.signedUrl}\n` +
    `También lo tienes disponible en tu portal, en Mis documentos.\n`;

  return sendEmail({
    to: input.to,
    subject: `Documento firmado — ${input.tituloDocumento}`,
    html: shellHtml({
      titulo: "Documento firmado",
      cuerpoHtml,
      footerEmpresa: input.empresaNombre,
    }),
    text,
    empresaId: input.empresaId,
    // Reply-To siempre no-reply: no se responde al software.
  });
}
