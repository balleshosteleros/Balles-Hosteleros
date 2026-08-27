/**
 * Aviso al empleado de que su correo de ACCESO al sistema ha cambiado.
 *
 * Se dispara desde `sincronizarLoginEmailEmpleado` cuando editar la ficha (o el
 * cambio manual en Ajustes → Usuarios) mueve el correo con el que entra. Va a
 * todos sus buzones conocidos —el nuevo, el antiguo y el otro de la ficha— para
 * que le llegue aunque haya perdido el acceso a uno de ellos.
 *
 * Deja claras las dos cosas que la persona necesita saber: con qué correo entra
 * a partir de ahora, y que el antiguo ya no sirve (tampoco con Google).
 */

export function cambioEmailAccesoEmail(opts: {
  recipientName: string;
  empresaNombre: string;
  anterior: string | null;
  nuevo: string;
  productName?: string;
}): { subject: string; html: string; text: string } {
  const product = opts.productName ?? "Balles Hosteleros";

  const subject = "Tu correo de acceso ha cambiado";

  const anteriorBloque = opts.anterior
    ? `<tr>
                    <td style="padding:12px 16px;border-top:1px solid #e2e8f0;">
                      <p style="margin:0 0 4px 0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Correo anterior (ya no sirve)</p>
                      <p style="margin:0;font-size:14px;color:#64748b;text-decoration:line-through;">${opts.anterior}</p>
                    </td>
                  </tr>`
    : "";

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <h1 style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">Tu correo de acceso ha cambiado</h1>
                <p style="margin:8px 0 0 0;font-size:13px;color:#64748b;">${opts.empresaNombre} · ${product}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 8px 32px;">
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#334155;">
                  Hola ${opts.recipientName}, hemos actualizado el correo con el que entras al sistema. A partir de ahora inicia sesión con el correo nuevo. <strong>Tu contraseña sigue siendo la misma.</strong>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 8px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;">
                  <tr>
                    <td style="padding:12px 16px;">
                      <p style="margin:0 0 4px 0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Tu correo de acceso</p>
                      <p style="margin:0;font-size:14px;color:#0f172a;font-weight:600;">${opts.nuevo}</p>
                    </td>
                  </tr>
                  ${anteriorBloque}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 16px 32px;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#334155;">
                  El correo anterior ya no da acceso al sistema, tampoco con el botón «Continuar con Google».
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px 32px;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;">
                  Este correo es automático. Si no esperabas este cambio, contacta con tu responsable o con RRHH.
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

Hemos actualizado el correo con el que entras al sistema en ${opts.empresaNombre}. A partir de ahora inicia sesión con el correo nuevo. Tu contraseña sigue siendo la misma.

Tu correo de acceso: ${opts.nuevo}${opts.anterior ? `\nCorreo anterior (ya no sirve): ${opts.anterior}` : ""}

El correo anterior ya no da acceso al sistema, tampoco con el botón "Continuar con Google".

Si no esperabas este cambio, contacta con tu responsable o con RRHH.

— ${product}`;

  return { subject, html, text };
}
