/**
 * Confirmación al empleado tras aprobar su solicitud de baja de contrato.
 * Se dispara desde aprobarSolicitud() cuando subtipo === 'baja_contrato'.
 */

export function bajaContratoRecibidaEmail(opts: {
  recipientName: string;
  empresaNombre: string;
  fechaSolicitud: string; // dd/mm/yyyy — primer día de preaviso
  fechaBaja: string; // dd/mm/yyyy — último día efectivo
  diasPreaviso: number;
  notasRevision?: string | null;
  productName?: string;
}): { subject: string; html: string; text: string } {
  const product = opts.productName ?? "Balles Hosteleros";

  const subject = `Hemos recibido tu solicitud de baja de contrato`;

  const notasBloque = opts.notasRevision
    ? `<tr>
        <td style="padding:0 32px 16px 32px;">
          <p style="margin:0 0 6px 0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Notas de RRHH</p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#334155;white-space:pre-wrap;">${opts.notasRevision}</p>
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
                <h1 style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">Hemos recibido tu solicitud</h1>
                <p style="margin:8px 0 0 0;font-size:13px;color:#64748b;">${opts.empresaNombre} · ${product}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 8px 32px;">
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#334155;">
                  Hola ${opts.recipientName}, te confirmamos que hemos recibido tu solicitud de baja de contrato. Nos pondremos con tu baja en los próximos días y te avisaremos cuando esté tramitada.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 8px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                  <tr>
                    <td style="padding:12px 16px;">
                      <p style="margin:0 0 4px 0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Fecha de solicitud</p>
                      <p style="margin:0;font-size:14px;color:#0f172a;font-weight:600;">${opts.fechaSolicitud}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 16px;border-top:1px solid #e2e8f0;">
                      <p style="margin:0 0 4px 0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Fecha solicitada de baja</p>
                      <p style="margin:0;font-size:14px;color:#0f172a;font-weight:600;">${opts.fechaBaja}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 16px;border-top:1px solid #e2e8f0;">
                      <p style="margin:0 0 4px 0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Preaviso</p>
                      <p style="margin:0;font-size:14px;color:#0f172a;font-weight:600;">${opts.diasPreaviso} días naturales</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${notasBloque}
            <tr>
              <td style="padding:16px 32px 24px 32px;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;">
                  Este correo es automático. Si necesitas hablar con RRHH, responde a este mensaje o contacta directamente con tu responsable.
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

Hemos recibido tu solicitud de baja de contrato en ${opts.empresaNombre}. Nos pondremos con tu baja en los próximos días y te avisaremos cuando esté tramitada.

Fecha de solicitud (inicio de preaviso): ${opts.fechaSolicitud}
Fecha solicitada de baja: ${opts.fechaBaja}
Preaviso: ${opts.diasPreaviso} días naturales
${opts.notasRevision ? `\nNotas de RRHH:\n${opts.notasRevision}\n` : ""}
Si necesitas hablar con RRHH, responde a este correo o contacta directamente con tu responsable.

— ${product}`;

  return { subject, html, text };
}
