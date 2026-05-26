/**
 * Plantilla HTML del email de follow-up de visita.
 *
 * Email-safe: tablas en vez de flex/grid, estilos inline. Probado en
 * Gmail / Outlook / Apple Mail. Las 5 estrellas son botones de fondo
 * coloreado para que se vean claras incluso si el cliente desactiva
 * imágenes.
 */

type EmailTemplateArgs = {
  nombreLead: string;
  nombreEmpresa: string;
  logoUrl: string | null;
  colorPrimario: string | null;
  asunto: string;
  cuerpo: string; // texto plano editable por la empresa
  baseUrl: string;
  resenaToken: string;
};

/** Sustituye placeholders dentro del texto editado por la empresa. */
function resolverPlaceholders(
  texto: string,
  vars: { nombre: string; nombre_empresa: string },
): string {
  return texto
    .replaceAll("{nombre}", vars.nombre)
    .replaceAll("{nombre_empresa}", vars.nombre_empresa);
}

export function generarEmailVisita(args: EmailTemplateArgs): {
  asunto: string;
  html: string;
} {
  const {
    nombreLead,
    nombreEmpresa,
    logoUrl,
    colorPrimario,
    asunto,
    cuerpo,
    baseUrl,
    resenaToken,
  } = args;

  const color = (colorPrimario && colorPrimario.trim()) || "#0ea5e9";
  const asuntoFinal = resolverPlaceholders(asunto, {
    nombre: nombreLead,
    nombre_empresa: nombreEmpresa,
  });
  const cuerpoFinal = resolverPlaceholders(cuerpo, {
    nombre: nombreLead,
    nombre_empresa: nombreEmpresa,
  });

  const cuerpoHtml = cuerpoFinal
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.6">${escapeHtml(p).replaceAll("\n", "<br/>")}</p>`)
    .join("");

  const linkResena = `${baseUrl.replace(/\/$/, "")}/r/${resenaToken}`;

  const estrellaBtn = (n: number) => `
    <a href="${linkResena}?rating=${n}"
       style="display:inline-block;text-decoration:none;width:44px;height:44px;line-height:44px;text-align:center;font-size:22px;background:${color};color:#ffffff;border-radius:50%;margin:0 4px;font-weight:bold">
      ${n}
    </a>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(asuntoFinal)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06)" cellpadding="0" cellspacing="0">
        <!-- Header -->
        <tr><td style="padding:24px 28px;border-bottom:1px solid #eef0f3;text-align:center">
          ${
            logoUrl
              ? `<img src="${escapeAttr(logoUrl)}" alt="${escapeAttr(nombreEmpresa)}" style="max-height:48px;max-width:160px;height:auto"/>`
              : `<div style="font-size:18px;font-weight:700;color:${color}">${escapeHtml(nombreEmpresa)}</div>`
          }
        </td></tr>
        <!-- Cuerpo -->
        <tr><td style="padding:28px 28px 8px 28px;font-size:15px;color:#222">
          ${cuerpoHtml}
        </td></tr>
        <!-- Estrellas -->
        <tr><td style="padding:8px 28px 12px 28px;text-align:center">
          <p style="margin:0 0 10px;font-size:14px;color:#555;font-weight:600">Pulsa una estrella para valorar</p>
          <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
            <td>${estrellaBtn(1)}</td>
            <td>${estrellaBtn(2)}</td>
            <td>${estrellaBtn(3)}</td>
            <td>${estrellaBtn(4)}</td>
            <td>${estrellaBtn(5)}</td>
          </tr></table>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:18px 28px 24px 28px;border-top:1px solid #eef0f3;font-size:12px;color:#9aa0a6;text-align:center">
          ${escapeHtml(nombreEmpresa)} · <a href="${escapeAttr(linkResena)}" style="color:#9aa0a6;text-decoration:underline">Dejar reseña</a>
        </td></tr>
      </table>
      <div style="font-size:11px;color:#bbb;margin-top:12px">
        Recibes este email porque visitaste ${escapeHtml(nombreEmpresa)}.
      </div>
    </td></tr>
  </table>
</body>
</html>`;

  return { asunto: asuntoFinal, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
