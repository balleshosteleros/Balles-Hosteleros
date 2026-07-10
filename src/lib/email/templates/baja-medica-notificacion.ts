/**
 * Aviso automático cuando un trabajador solicita una BAJA MÉDICA desde Mi Panel.
 * Se envía a la gestoría (para que tramite) y a gerencia (para que quede
 * advertida). Se dispara desde crearSolicitudPersonal() cuando
 * subtipo === 'baja_medica' (ver onBajaMedicaCreada).
 *
 * `destinatario` cambia el encabezado/copy según a quién va: la gestoría recibe
 * una petición de tramitación; gerencia recibe un aviso informativo.
 */

function escapeHtml(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function bajaMedicaNotificacionEmail(opts: {
  destinatario: "gestoria" | "gerencia";
  empleadoNombre: string;
  empresaNombre: string;
  dniNie?: string | null;
  local?: string | null;
  puesto?: string | null;
  fechaSolicitud: string; // dd/mm/yyyy — cuándo se registró
  fechaInicio: string; // dd/mm/yyyy — inicio de la baja
  fechaFin?: string | null; // dd/mm/yyyy — fin estimado (opcional)
  motivo?: string | null;
  productName?: string;
}): { subject: string; html: string; text: string } {
  const product = opts.productName ?? "Balles Hosteleros";
  const esGestoria = opts.destinatario === "gestoria";

  const subject = esGestoria
    ? `${opts.empresaNombre} · Baja médica a tramitar: ${opts.empleadoNombre}`
    : `${opts.empresaNombre} · Aviso de baja médica: ${opts.empleadoNombre}`;

  const intro = esGestoria
    ? `Un trabajador de <strong>${escapeHtml(opts.empresaNombre)}</strong> ha comunicado una baja médica. Os trasladamos los datos para que procedáis a su <strong>tramitación</strong>.`
    : `Os informamos de que un trabajador de <strong>${escapeHtml(opts.empresaNombre)}</strong> ha comunicado una <strong>baja médica</strong>. Este es un aviso automático para que quedéis advertidos; la gestoría ya ha recibido los datos para tramitarla.`;

  const introText = esGestoria
    ? `Un trabajador de ${opts.empresaNombre} ha comunicado una baja médica. Os trasladamos los datos para que procedáis a su tramitación.`
    : `Os informamos de que un trabajador de ${opts.empresaNombre} ha comunicado una baja médica. Este es un aviso automático para que quedéis advertidos; la gestoría ya ha recibido los datos para tramitarla.`;

  const filas: { label: string; value: string }[] = [
    { label: "Trabajador", value: opts.empleadoNombre },
  ];
  if (opts.dniNie) filas.push({ label: "DNI / NIE", value: opts.dniNie });
  if (opts.puesto) filas.push({ label: "Puesto", value: opts.puesto });
  if (opts.local) filas.push({ label: "Centro / Local", value: opts.local });
  filas.push({ label: "Fecha de comunicación", value: opts.fechaSolicitud });
  filas.push({ label: "Inicio de la baja", value: opts.fechaInicio });
  if (opts.fechaFin) filas.push({ label: "Fin estimado", value: opts.fechaFin });

  const filasHtml = filas
    .map(
      (f, i) => `
        <tr>
          <td style="padding:12px 16px;${i > 0 ? "border-top:1px solid #e2e8f0;" : ""}">
            <p style="margin:0 0 4px 0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(f.label)}</p>
            <p style="margin:0;font-size:14px;color:#0f172a;font-weight:600;">${escapeHtml(f.value)}</p>
          </td>
        </tr>`,
    )
    .join("");

  const motivoBloque = opts.motivo
    ? `<tr>
        <td style="padding:0 32px 16px 32px;">
          <p style="margin:0 0 6px 0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Detalles indicados por el trabajador</p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#334155;white-space:pre-wrap;">${escapeHtml(opts.motivo)}</p>
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
                <h1 style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">${esGestoria ? "Baja médica a tramitar" : "Aviso de baja médica"}</h1>
                <p style="margin:8px 0 0 0;font-size:13px;color:#64748b;">${escapeHtml(opts.empresaNombre)} · ${product}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 8px 32px;">
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#334155;">${intro}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 8px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                  ${filasHtml}
                </table>
              </td>
            </tr>
            ${motivoBloque}
            <tr>
              <td style="padding:16px 32px 24px 32px;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;">
                  Correo automático enviado desde ${escapeHtml(opts.empresaNombre)}. No es necesario responder a este mensaje.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const detalleTexto = filas.map((f) => `${f.label}: ${f.value}`).join("\n");
  const text = `${esGestoria ? "Baja médica a tramitar" : "Aviso de baja médica"} — ${opts.empresaNombre}

${introText}

${detalleTexto}
${opts.motivo ? `\nDetalles indicados por el trabajador:\n${opts.motivo}\n` : ""}
Correo automático. No es necesario responder.

— ${product}`;

  return { subject, html, text };
}
