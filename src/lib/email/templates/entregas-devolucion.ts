/**
 * Correo al trabajador que ya ha salido y tiene material sin devolver.
 *
 * Sale al entrar su salida en la fase de Entregas. Corto y sin rodeos: qué
 * tiene, con quién lo entrega, y qué pasa después. El orden importa — primero
 * la lista, porque es lo único que tiene que mirar.
 */

export function entregasDevolucionEmail(opts: {
  recipientName: string;
  empresaNombre: string;
  /** `<li>` ya montados con las piezas pendientes. */
  listaHtml: string;
  /** Misma lista en texto plano. */
  listaText: string;
  productName?: string;
}): { subject: string; html: string; text: string } {
  const product = opts.productName ?? "Balles Hosteleros";

  const subject = "Te queda material por devolver";

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <h1 style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">Te queda material por devolver</h1>
                <p style="margin:8px 0 0 0;font-size:13px;color:#64748b;">${opts.empresaNombre} · ${product}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 8px 32px;">
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#334155;">
                  Hola ${opts.recipientName}, esto es lo que tenemos registrado a tu nombre y sigue sin devolver:
                </p>
                <ul style="margin:0 0 16px 0;padding-left:20px;font-size:14px;line-height:1.7;color:#0f172a;">
                  ${opts.listaHtml}
                </ul>
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#334155;">
                  <strong>Ponte en contacto con RRHH</strong> para entregarlo. Cuando lo recibamos te enviaremos
                  un documento de devolución para que lo firmes.
                </p>
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#334155;">
                  Con esa firma pasamos al último paso: tu <strong>finiquito</strong>, que es lo que
                  cierra tu relación laboral con nosotros. Hasta entonces no podemos darlo por cerrado.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px 32px;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;">
                  Este correo es automático. Si algo de esta lista ya lo devolviste o se estropeó, díselo a RRHH y lo corregimos.
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

Esto es lo que tenemos registrado a tu nombre y sigue sin devolver:

${opts.listaText}

Ponte en contacto con RRHH para entregarlo. Cuando lo recibamos te enviaremos un documento de devolución para que lo firmes.

Con esa firma pasamos al último paso: tu finiquito, que es lo que cierra tu relación laboral con nosotros. Hasta entonces no podemos darlo por cerrado.

Si algo de esta lista ya lo devolviste o se estropeó, díselo a RRHH y lo corregimos.

— ${product}`;

  return { subject, html, text };
}
