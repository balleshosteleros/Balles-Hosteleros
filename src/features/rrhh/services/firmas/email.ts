import { sendEmail, type SendEmailResult } from "@/lib/email/send";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.balleshosteleros.com";

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
  empresaLogoUrl?: string | null;
}) {
  const fontStack =
    "'Inter','Inter Placeholder',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const logoHtml = opts.empresaLogoUrl
    ? `<img src="${esc(opts.empresaLogoUrl)}" alt="${esc(opts.footerEmpresa)}" height="72" style="display:block;height:72px;width:auto;max-width:220px;border:0;outline:none;text-decoration:none;margin:0 auto;" />`
    : `<div style="font-size:24px;font-weight:700;color:#0f172a;letter-spacing:-0.01em;text-align:center;">${esc(opts.footerEmpresa)}</div>`;
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#ffffff;font-family:${fontStack};color:#0f172a;-webkit-font-smoothing:antialiased;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <tr><td align="center" style="padding:0 4px 28px 4px;text-align:center;">${logoHtml}</td></tr>
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
};

export async function enviarInvitacionFirma(input: InvitacionFirmaInput): Promise<SendEmailResult> {
  const url = `${APP_URL}/firmar/${encodeURIComponent(input.token)}`;
  const expira = input.expiraEn.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const cuerpoHtml = `
    <p>Hola ${esc(input.empleadoNombre)},</p>
    <p>La dirección de ${esc(input.empresaNombre)} te ha enviado un documento para firma electrónica:</p>
    <p style="margin:12px 0;padding:12px 14px;background:#f1f5f9;border-left:3px solid #6366f1;font-weight:500;color:#0f172a;">
      ${esc(input.tituloDocumento)}
    </p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${url}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:500;">
        Firmar documento
      </a>
    </p>
    <p style="font-size:13px;color:#64748b;">El enlace es personal y de un solo uso. Caduca el <strong>${esc(expira)}</strong>.</p>
    <p style="font-size:13px;color:#64748b;">Si no esperabas este correo, ignóralo o contacta con RRHH de ${esc(input.empresaNombre)}.</p>
  `;
  const text =
    `Hola ${input.empleadoNombre},\n\n` +
    `La dirección de ${input.empresaNombre} te ha enviado un documento para firma electrónica:\n` +
    `  ${input.tituloDocumento}\n\n` +
    `Firma aquí: ${url}\n` +
    `Enlace personal y de un solo uso. Caduca el ${expira}.\n`;

  return sendEmail({
    to: input.to,
    subject: `Documento para firmar — ${input.tituloDocumento}`,
    html: shellHtml({
      titulo: "Documento para firmar",
      cuerpoHtml,
      footerEmpresa: input.empresaNombre,
      empresaLogoUrl: input.empresaLogoUrl,
    }),
    text,
    empresaId: input.empresaId,
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
      <span style="display:inline-block;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:32px;letter-spacing:8px;padding:14px 22px;background:#0f172a;color:#fde68a;border-radius:10px;">
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
      empresaLogoUrl: input.empresaLogoUrl,
    }),
    text,
    empresaId: input.empresaId,
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
  const firmadoStr = input.firmadoEn.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const cuerpoHtml = `
    <p>Hola ${esc(input.empleadoNombre)},</p>
    <p>Has firmado correctamente el documento <strong>${esc(input.tituloDocumento)}</strong> el ${esc(firmadoStr)}.</p>
    <p>Puedes descargar tu copia (documento original + acta de firma):</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${input.signedUrl}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:500;">
        Descargar copia firmada
      </a>
    </p>
    <p style="font-size:13px;color:#64748b;">El enlace de descarga caduca en 7 días. Guarda una copia en tu equipo.</p>
  `;
  const text =
    `Hola ${input.empleadoNombre},\n\n` +
    `Has firmado correctamente "${input.tituloDocumento}" el ${firmadoStr}.\n` +
    `Descarga tu copia: ${input.signedUrl}\n`;

  return sendEmail({
    to: input.to,
    subject: `Documento firmado — ${input.tituloDocumento}`,
    html: shellHtml({
      titulo: "Documento firmado",
      cuerpoHtml,
      footerEmpresa: input.empresaNombre,
      empresaLogoUrl: input.empresaLogoUrl,
    }),
    text,
    empresaId: input.empresaId,
  });
}
