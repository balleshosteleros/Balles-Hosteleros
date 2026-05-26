/**
 * Aviso interno a RRHH cuando un empleado solicita su baja de contrato.
 * Se dispara desde crearSolicitudPersonal() al insertar la solicitud.
 */

export function bajaContratoAvisoRrhhEmail(opts: {
  empleadoNombre: string;
  empleadoDni: string | null;
  empresaNombre: string;
  fechaSolicitud: string;
  fechaBaja: string;
  diasPreaviso: number;
  motivo: string | null;
  enlacePanel: string;
  productName?: string;
}): { subject: string; html: string; text: string } {
  const product = opts.productName ?? "Balles Hosteleros";

  const subject = `[Baja voluntaria] ${opts.empleadoNombre} — efectiva ${opts.fechaBaja}`;

  const motivoBloque = opts.motivo
    ? `<tr>
        <td style="padding:0 32px 16px 32px;">
          <p style="margin:0 0 6px 0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Motivo</p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#334155;white-space:pre-wrap;">${opts.motivo}</p>
        </td>
      </tr>`
    : "";

  const dniBloque = opts.empleadoDni
    ? `<p style="margin:0;font-size:12px;color:#64748b;">DNI/NIE: ${opts.empleadoDni}</p>`
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
                <p style="margin:0;font-size:12px;color:#b45309;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Nueva solicitud · Baja voluntaria</p>
                <h1 style="margin:6px 0 0 0;font-size:20px;font-weight:700;color:#0f172a;">${opts.empleadoNombre}</h1>
                ${dniBloque}
                <p style="margin:6px 0 0 0;font-size:12px;color:#64748b;">${opts.empresaNombre} · ${product}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 8px 32px;">
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#334155;">
                  El/la empleado/a ha enviado una solicitud de baja voluntaria. El periodo de preaviso arranca en la fecha de solicitud. Recibirá una carta de baja para firmar electrónicamente.
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
                      <p style="margin:0 0 4px 0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Fecha efectiva de baja</p>
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
            ${motivoBloque}
            <tr>
              <td align="center" style="padding:16px 32px 24px 32px;">
                <a href="${opts.enlacePanel}" target="_blank"
                  style="display:inline-block;padding:12px 24px;background:#0f172a;color:#ffffff;font-weight:600;font-size:14px;text-decoration:none;border-radius:9999px;">
                  Revisar en RRHH
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px 32px;border-top:1px solid #e2e8f0;">
                <p style="margin:16px 0 0 0;font-size:11px;color:#94a3b8;line-height:1.5;">
                  Cuando aprobéis la solicitud, el empleado recibirá un correo de confirmación automático.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `Nueva solicitud de baja voluntaria

Empleado: ${opts.empleadoNombre}${opts.empleadoDni ? ` (DNI/NIE ${opts.empleadoDni})` : ""}
Empresa: ${opts.empresaNombre}

Fecha de solicitud: ${opts.fechaSolicitud}
Fecha efectiva de baja: ${opts.fechaBaja}
Preaviso: ${opts.diasPreaviso} días naturales
${opts.motivo ? `\nMotivo:\n${opts.motivo}\n` : ""}
Revisar en RRHH: ${opts.enlacePanel}

— ${product}`;

  return { subject, html, text };
}
