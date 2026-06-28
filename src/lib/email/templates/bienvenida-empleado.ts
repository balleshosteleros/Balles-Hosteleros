/**
 * Email de bienvenida tras promover un candidato a empleado (PRP-034).
 * Su objetivo es que el empleado ELIJA su propia contraseña: esa contraseña le
 * permite moverse por todo el sistema y es la que necesitará para acciones de
 * seguridad (ver contraseñas guardadas). Hasta que no la elija, no puede entrar
 * — ni siquiera con Google.
 * Inline-styles porque la mayoría de clientes de email no soportan <style>.
 */

export function bienvenidaEmpleadoEmail(opts: {
  recipientName: string;
  actionUrl: string;
  empresaNombre: string;
  productName?: string;
}): { subject: string; html: string; text: string } {
  const product = opts.productName ?? "Balles Hosteleros";

  const subject = `Crea tu contraseña de acceso · ${opts.empresaNombre}`;

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <h1 style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">¡Bienvenido/a, ${opts.recipientName}!</h1>
                <p style="margin:8px 0 0 0;font-size:13px;color:#64748b;">${opts.empresaNombre} · ${product}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 8px 32px;">
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#334155;">
                  Tu cuenta ya está lista. Para empezar, <strong>elige tu contraseña</strong>:
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 32px 20px 32px;">
                <a href="${opts.actionUrl}" target="_blank"
                  style="display:inline-block;padding:14px 28px;background:#0f172a;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;border-radius:9999px;">
                  Crear mi contraseña
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 8px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
                  <tr>
                    <td style="padding:14px 16px;">
                      <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#334155;">
                        🔑 <strong>Esta contraseña te permitirá moverte por todo el sistema de la empresa.</strong>
                        Guárdala bien: la necesitarás siempre.
                      </p>
                      <p style="margin:0;font-size:13px;line-height:1.6;color:#334155;">
                        Podrás entrar siempre haciendo <strong>login con Google</strong>, pero
                        <strong>aun así necesitarás esta contraseña</strong> para acciones de seguridad.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 24px 32px;">
                <p style="margin:0 0 6px 0;font-size:12px;color:#94a3b8;">
                  Si el botón no funciona, copia y pega este enlace en tu navegador:
                </p>
                <p style="margin:0;font-size:11px;color:#475569;word-break:break-all;">${opts.actionUrl}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px 32px;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;">
                  Este enlace caduca en 1 hora. Si no esperabas este correo o ha pasado mucho tiempo,
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

  const text = `¡Bienvenido/a, ${opts.recipientName}!

Tu cuenta en ${product} (${opts.empresaNombre}) ya está lista. Para empezar, elige tu contraseña con este enlace (caduca en 1 hora):
${opts.actionUrl}

IMPORTANTE: esta contraseña te permitirá moverte por todo el sistema de la empresa. Guárdala bien, la necesitarás siempre.

Podrás entrar siempre haciendo login con Google, pero aun así necesitarás esta contraseña para acciones de seguridad.

Si tienes dudas, contacta con tu responsable de RRHH.`;

  return { subject, html, text };
}
