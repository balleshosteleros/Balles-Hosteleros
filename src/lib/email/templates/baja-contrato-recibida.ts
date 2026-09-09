/**
 * Aviso al trabajador de que su solicitud de baja ha sido APROBADA.
 * Se dispara desde aprobarSolicitud() cuando subtipo === 'baja_contrato'.
 *
 * Dos fechas, y no son la misma: el ÚLTIMO DÍA que viene a trabajar y el día en
 * que la baja es efectiva, que es el siguiente. Confundirlas es el error clásico
 * de las bajas (se le cita un día que ya no es suyo), así que van separadas y
 * con su nombre.
 *
 * Tono: se acepta la baja, se le agradece y se le desea lo mejor. Y se le avisa
 * de que RRHH PUEDE ponerse en contacto durante el preaviso por si cabe
 * retenerle — dicho como lo que es, una posibilidad y no una promesa: si luego
 * nadie le llama, no debe quedarse esperando una llamada que no va a llegar.
 *
 * Corto a propósito: se lee de una pasada en el móvil.
 */

export function bajaContratoRecibidaEmail(opts: {
  recipientName: string;
  empresaNombre: string;
  /** dd/mm/aaaa — último día que trabaja. */
  fechaBaja: string;
  /** dd/mm/aaaa — día en que la baja es efectiva (el siguiente al último). */
  fechaEfectiva: string;
  notasRevision?: string | null;
  productName?: string;
}): { subject: string; html: string; text: string } {
  const product = opts.productName ?? "Balles Hosteleros";

  const subject = "Tu baja ha sido aprobada";

  const notasBloque = opts.notasRevision
    ? `<tr>
        <td style="padding:0 32px 16px 32px;">
          <p style="margin:0 0 6px 0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Nota de RRHH</p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#334155;white-space:pre-wrap;">${opts.notasRevision}</p>
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
                <h1 style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">Tu baja ha sido aprobada</h1>
                <p style="margin:8px 0 0 0;font-size:13px;color:#64748b;">${opts.empresaNombre} · ${product}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 8px 32px;">
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#334155;">
                  Hola ${opts.recipientName}, hemos aprobado tu solicitud de baja. Sentimos que te vayas y te deseamos lo mejor.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 8px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;">
                  <tr>
                    <td style="padding:12px 16px;">
                      <p style="margin:0 0 4px 0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Tu último día de trabajo</p>
                      <p style="margin:0;font-size:14px;color:#0f172a;font-weight:600;">${opts.fechaBaja}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 16px;border-top:1px solid #e2e8f0;">
                      <p style="margin:0 0 4px 0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Baja efectiva</p>
                      <p style="margin:0;font-size:14px;color:#0f172a;font-weight:600;">${opts.fechaEfectiva}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 8px 32px;">
                <p style="margin:0;font-size:14px;line-height:1.6;color:#334155;">
                  Hasta esa fecha puede que RRHH se ponga en contacto contigo para hablarlo, por si podemos hacer algo para que sigas en el equipo. No siempre ocurre, pero queremos que lo sepas.
                </p>
              </td>
            </tr>
            ${notasBloque}
            <tr>
              <td style="padding:16px 32px 24px 32px;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;">
                  Este correo es automático. Si necesitas hablar con RRHH, contacta con tu responsable.
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

Hemos aprobado tu solicitud de baja en ${opts.empresaNombre}. Sentimos que te vayas y te deseamos lo mejor.

Tu último día de trabajo: ${opts.fechaBaja}
Baja efectiva: ${opts.fechaEfectiva}

Hasta esa fecha puede que RRHH se ponga en contacto contigo para hablarlo, por si podemos hacer algo para que sigas en el equipo. No siempre ocurre, pero queremos que lo sepas.
${opts.notasRevision ? `\nNota de RRHH:\n${opts.notasRevision}\n` : ""}
Si necesitas hablar con RRHH, contacta con tu responsable.

— ${product}`;

  return { subject, html, text };
}
