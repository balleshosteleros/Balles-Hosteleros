/**
 * Email de bienvenida tras promover un candidato a empleado (PRP-034).
 * Inline-styles porque la mayoría de clientes de email no soportan <style>.
 */

export function bienvenidaEmpleadoEmail(opts: {
  recipientName: string;
  actionUrl: string;
  empresaNombre: string;
  productName?: string;
}): { subject: string; html: string; text: string } {
  const product = opts.productName ?? "Balles Hosteleros";

  const subject = `Bienvenido/a a ${opts.empresaNombre}`;

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
                  Te damos la bienvenida al equipo. Ya tenemos lista tu cuenta en el sistema de gestión.
                </p>
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#334155;">
                  Pulsa el botón para entrar por primera vez. Te pediremos que completes algunos datos personales (DNI, IBAN, dirección, etc.) antes de empezar.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:16px 32px 24px 32px;">
                <a href="${opts.actionUrl}" target="_blank"
                  style="display:inline-block;padding:14px 28px;background:#0f172a;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;border-radius:9999px;">
                  Entrar al sistema
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px 32px;">
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

Te damos la bienvenida al equipo de ${opts.empresaNombre}. Ya tenemos lista tu cuenta en ${product}.

Entra al sistema con este enlace (caduca en 1 hora):
${opts.actionUrl}

La primera vez te pediremos completar algunos datos personales (DNI, IBAN, dirección, etc.) antes de empezar.

Si tienes dudas, contacta con tu responsable de RRHH.`;

  return { subject, html, text };
}
