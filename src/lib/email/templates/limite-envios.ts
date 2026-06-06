/**
 * Aviso al dueño del software cuando los correos enviados hoy se acercan al límite
 * diario gratuito del transporte (Gmail Workspace, ~2.000/día para toda la
 * plataforma). Se dispara una sola vez al día desde `sendEmail()` al cruzar el
 * umbral configurado (`EMAIL_LIMITE_AVISO`, por defecto 1.800).
 */

export function limiteEnviosEmail(opts: {
  total: number;
  limite: number;
  umbral: number;
  esPrueba?: boolean;
  productName?: string;
}): { subject: string; html: string; text: string } {
  const product = opts.productName ?? "Balles Hosteleros";
  const pct = Math.round((opts.total / opts.limite) * 100);
  const restantes = Math.max(0, opts.limite - opts.total);
  const prefijo = opts.esPrueba ? "[PRUEBA] " : "";

  const subject = `${prefijo}⚠️ Correos del día: ${opts.total} de ${opts.limite} (${pct}%)`;

  const avisoPrueba = opts.esPrueba
    ? `<tr>
        <td style="padding:0 32px 16px 32px;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#92400e;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;">
            Esto es un <strong>correo de prueba</strong> para que veas cómo te llegará el aviso real. No hay que hacer nada.
          </p>
        </td>
      </tr>`
    : "";

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <p style="margin:0;font-size:12px;color:#b45309;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Aviso del sistema · Correos</p>
                <h1 style="margin:6px 0 0 0;font-size:20px;font-weight:700;color:#0f172a;">Te acercas al límite diario de correos</h1>
                <p style="margin:6px 0 0 0;font-size:12px;color:#64748b;">${product}</p>
              </td>
            </tr>
            ${avisoPrueba}
            <tr>
              <td style="padding:8px 32px 8px 32px;">
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#334155;">
                  Hoy la plataforma lleva enviados <strong>${opts.total}</strong> correos, de un máximo gratuito de <strong>${opts.limite}</strong> al día. Te quedan unos <strong>${restantes}</strong> antes de tocar el tope.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 8px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                  <tr>
                    <td style="padding:12px 16px;">
                      <p style="margin:0 0 4px 0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Enviados hoy</p>
                      <p style="margin:0;font-size:18px;color:#0f172a;font-weight:700;">${opts.total} <span style="font-size:13px;color:#64748b;font-weight:500;">/ ${opts.limite} (${pct}%)</span></p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 24px 32px;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#334155;">
                  ¿Qué hacer si esto se repite varios días? Significa que el volumen ha crecido y conviene pasar el envío de correos a un proveedor con más capacidad. No urge: hoy todavía hay margen.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px 32px;border-top:1px solid #e2e8f0;">
                <p style="margin:16px 0 0 0;font-size:11px;color:#94a3b8;line-height:1.5;">
                  Aviso automático. No respondas a este correo (este buzón no se atiende). El contador se reinicia cada día.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `${prefijo}Aviso: te acercas al límite diario de correos

${opts.esPrueba ? "(Esto es un correo de PRUEBA para que veas cómo llegará el aviso real.)\n\n" : ""}Hoy la plataforma lleva enviados ${opts.total} correos, de un máximo gratuito de ${opts.limite}/día (${pct}%).
Te quedan unos ${restantes} antes de tocar el tope.

Si esto se repite varios días, conviene pasar el envío a un proveedor con más capacidad.

Aviso automático. No respondas a este correo.
— ${product}`;

  return { subject, html, text };
}
