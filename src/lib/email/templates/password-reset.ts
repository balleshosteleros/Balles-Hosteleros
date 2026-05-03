/**
 * Plantilla HTML del correo de recuperación de contraseña.
 * Inline-styles porque la mayoría de clientes de email no soportan <style>.
 */

export function passwordResetEmail(opts: {
  recipientName?: string;
  actionUrl: string;
  empresaNombre?: string;
  productName?: string;
}): { subject: string; html: string; text: string } {
  const product = opts.productName ?? 'Balles Hosteleros';
  const empresa = opts.empresaNombre ? ` — ${opts.empresaNombre}` : '';
  const greeting = opts.recipientName
    ? `Hola ${opts.recipientName},`
    : 'Hola,';

  const subject = `Recupera tu contraseña — ${product}${empresa}`;

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <h1 style="margin:0;font-size:20px;font-weight:700;color:#0f172a;">Recupera tu contraseña</h1>
                <p style="margin:8px 0 0 0;font-size:13px;color:#64748b;">${product}${empresa}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 8px 32px;">
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#334155;">${greeting}</p>
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#334155;">
                  Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.
                  Pulsa el botón de abajo para crear una nueva contraseña — el enlace caduca en 1 hora.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:16px 32px 24px 32px;">
                <a href="${opts.actionUrl}"
                   style="display:inline-block;background:#0ea5e9;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">
                  Restablecer contraseña
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px 32px;">
                <p style="margin:0 0 8px 0;font-size:12px;color:#64748b;">
                  Si el botón no funciona, copia y pega este enlace en tu navegador:
                </p>
                <p style="margin:0;font-size:12px;color:#0ea5e9;word-break:break-all;">${opts.actionUrl}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 32px 32px;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
                  Si tú no solicitaste este cambio, puedes ignorar este correo de forma segura.
                  Tu contraseña actual seguirá siendo válida.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0 0;font-size:11px;color:#94a3b8;">© ${new Date().getFullYear()} ${product}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `${greeting}

Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en ${product}${empresa}.

Abre este enlace para crear una nueva contraseña (caduca en 1 hora):
${opts.actionUrl}

Si tú no solicitaste este cambio, ignora este correo.`;

  return { subject, html, text };
}
