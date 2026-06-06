/**
 * Recordatorio para que un empleado rellene un cuestionario que tiene
 * pendiente. Se envía bajo demanda desde RRHH y SOLO mientras el cuestionario
 * sigue sin rellenar; no reabre ni reedita nada ya enviado.
 * Inline-styles porque la mayoría de clientes de email no soportan <style>.
 */

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function cuestionarioRecordatorioEmail(opts: {
  recipientName: string;
  cuestionarioNombre: string;
  actionUrl: string;
  empresaNombre: string;
  productName?: string;
}): { subject: string; html: string; text: string } {
  const product = opts.productName ?? "Balles Hosteleros";
  const nombre = esc(opts.recipientName);
  const cuestionario = esc(opts.cuestionarioNombre);
  const empresa = esc(opts.empresaNombre);
  const url = opts.actionUrl;

  const subject = `Recordatorio: tienes pendiente el cuestionario «${opts.cuestionarioNombre}»`;

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <h1 style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">Tienes un cuestionario pendiente</h1>
                <p style="margin:8px 0 0 0;font-size:13px;color:#64748b;">${empresa} · ${esc(product)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 8px 32px;">
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#334155;">
                  Hola ${nombre}, todavía no has rellenado el cuestionario
                  <strong>«${cuestionario}»</strong>.
                </p>
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#334155;">
                  Cuando puedas, entra y complétalo. Se rellena una sola vez, así que
                  tómate el tiempo que necesites antes de enviarlo.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:16px 32px 24px 32px;">
                <a href="${url}" target="_blank"
                  style="display:inline-block;padding:14px 28px;background:#0f172a;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;border-radius:9999px;">
                  Rellenar el cuestionario
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px 32px;">
                <p style="margin:0 0 6px 0;font-size:12px;color:#94a3b8;">
                  Si el botón no funciona, copia y pega este enlace en tu navegador:
                </p>
                <p style="margin:0;font-size:11px;color:#475569;word-break:break-all;">${url}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px 32px;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;">
                  Si ya lo has completado, ignora este mensaje. Para cualquier duda,
                  contacta con tu responsable de RRHH.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `Hola ${opts.recipientName},

Todavía no has rellenado el cuestionario «${opts.cuestionarioNombre}» en ${opts.empresaNombre}.

Entra y complétalo cuando puedas (se rellena una sola vez):
${opts.actionUrl}

Si ya lo has completado, ignora este mensaje. Para cualquier duda, contacta con tu responsable de RRHH.`;

  return { subject, html, text };
}
