import { sendEmail, type SendEmailResult } from "@/lib/email/send";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.balleshosteleros.com";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shellHtml(opts: { titulo: string; cuerpoHtml: string; footerEmpresa: string }) {
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <tr><td style="padding:24px 28px 8px 28px;">
            <h1 style="margin:0 0 4px;font-size:18px;font-weight:600;color:#0f172a;">${esc(opts.titulo)}</h1>
          </td></tr>
          <tr><td style="padding:8px 28px 24px 28px;font-size:14px;line-height:1.55;color:#334155;">
            ${opts.cuerpoHtml}
          </td></tr>
          <tr><td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e5e7eb;font-size:12px;color:#64748b;">
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
    <p>${esc(input.enviadoPor)} (${esc(input.empresaNombre)}) te ha enviado un documento para firma electrónica:</p>
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
    `${input.enviadoPor} (${input.empresaNombre}) te ha enviado un documento para firma electrónica:\n` +
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
    }),
    text,
    empresaId: input.empresaId,
  });
}

export type CodigoOTPInput = {
  to: string;
  empresaId: string;
  empresaNombre: string;
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
    }),
    text,
    empresaId: input.empresaId,
  });
}

export type CopiaFirmadaInput = {
  to: string;
  empresaId: string;
  empresaNombre: string;
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
    }),
    text,
    empresaId: input.empresaId,
  });
}
