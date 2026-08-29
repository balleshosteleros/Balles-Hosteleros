/**
 * Aviso al dueño del software sobre el GASTO DE IA del mes.
 *
 * Dos momentos, un solo correo cada uno (ver `avisarGastoIa` en
 * `lib/ia/aviso-gasto.ts`):
 *  · "aviso"    → se ha cruzado el 80% del tope. Informativo, todo sigue.
 *  · "detenido" → se ha alcanzado el tope. La IA está parada hasta el día 1.
 *
 * A la pantalla del empleado nunca llega ninguna de estas cifras: él solo ve un
 * "no se ha podido completar la operación". El detalle es cosa de administración.
 */

export function limiteIaEmail(opts: {
  tipo: "aviso" | "detenido";
  gastado: number;
  tope: number;
  esPrueba?: boolean;
  productName?: string;
}): { subject: string; html: string; text: string } {
  const product = opts.productName ?? "Balles Hosteleros";
  const pct = Math.round((opts.gastado / opts.tope) * 100);
  const restante = Math.max(0, opts.tope - opts.gastado);
  const prefijo = opts.esPrueba ? "[PRUEBA] " : "";
  const detenido = opts.tipo === "detenido";

  const eur = (n: number) => n.toFixed(2).replace(".", ",") + " €";

  const subject = detenido
    ? `${prefijo}🛑 IA detenida: alcanzado el límite de ${eur(opts.tope)} del mes`
    : `${prefijo}⚠️ Gasto de IA: ${eur(opts.gastado)} de ${eur(opts.tope)} (${pct}%)`;

  const titular = detenido
    ? "Las funciones de IA se han detenido"
    : "El gasto de IA se acerca al límite";

  const entradilla = detenido
    ? `Este mes se ha alcanzado el límite de gasto de <strong>${eur(opts.tope)}</strong>. Las funciones de inteligencia artificial —leer albaranes y nóminas, pulir correos— <strong>están detenidas</strong> y se reactivan solas el día 1 del mes que viene.`
    : `Este mes se llevan gastados <strong>${eur(opts.gastado)}</strong> de un límite de <strong>${eur(opts.tope)}</strong>. Quedan <strong>${eur(restante)}</strong> antes de que la IA se detenga sola.`;

  const queHacer = detenido
    ? `Si hace falta usarlas antes de fin de mes, hay que ampliar el límite (variable <code style="background:#f1f5f9;padding:1px 4px;border-radius:3px;">IA_TOPE_EUROS_MES</code>). Nadie ha visto ningún mensaje sobre dinero: a quien lo intente le sale un aviso genérico de que no se ha podido completar la operación.`
    : `No hay que hacer nada por ahora. Si el mes suele acabar aquí, conviene revisar si el límite se queda corto o si algo está consumiendo más de lo esperado.`;

  const color = detenido ? "#b91c1c" : "#b45309";
  const fondoCaja = detenido ? "#fef2f2" : "#fffbeb";
  const bordeCaja = detenido ? "#fecaca" : "#fde68a";

  const avisoPrueba = opts.esPrueba
    ? `<tr>
        <td style="padding:0 32px 16px 32px;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#92400e;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;">
            Esto es un <strong>correo de prueba</strong> para que veas cómo te llegará el aviso real. No hay que hacer nada.
          </p>
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
                <p style="margin:0;font-size:12px;color:${color};text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Aviso del sistema · Inteligencia artificial</p>
                <h1 style="margin:6px 0 0 0;font-size:20px;font-weight:700;color:#0f172a;">${titular}</h1>
                <p style="margin:6px 0 0 0;font-size:12px;color:#64748b;">${product}</p>
              </td>
            </tr>
            ${avisoPrueba}
            <tr>
              <td style="padding:8px 32px 8px 32px;">
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#334155;">${entradilla}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 8px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${fondoCaja};border:1px solid ${bordeCaja};border-radius:8px;">
                  <tr>
                    <td style="padding:12px 16px;">
                      <p style="margin:0 0 4px 0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Gastado este mes</p>
                      <p style="margin:0;font-size:18px;color:#0f172a;font-weight:700;">${eur(opts.gastado)} <span style="font-size:13px;color:#64748b;font-weight:500;">/ ${eur(opts.tope)} (${pct}%)</span></p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 24px 32px;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#334155;">${queHacer}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px 32px;border-top:1px solid #e2e8f0;">
                <p style="margin:16px 0 0 0;font-size:11px;color:#94a3b8;line-height:1.5;">
                  Aviso automático. No respondas a este correo (este buzón no se atiende). El contador se reinicia el día 1 de cada mes. El importe es una estimación calculada al alza, así que la factura real de Google suele ser algo menor.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `${prefijo}${titular}

${opts.esPrueba ? "(Esto es un correo de PRUEBA para que veas cómo llegará el aviso real.)\n\n" : ""}${
    detenido
      ? `Este mes se ha alcanzado el límite de gasto de ${eur(opts.tope)}. Las funciones de IA están detenidas y se reactivan solas el día 1 del mes que viene.`
      : `Este mes se llevan gastados ${eur(opts.gastado)} de un límite de ${eur(opts.tope)} (${pct}%). Quedan ${eur(restante)} antes de que la IA se detenga sola.`
  }

${
  detenido
    ? "Si hace falta usarlas antes de fin de mes, hay que ampliar el límite (IA_TOPE_EUROS_MES). A los empleados no se les muestra ninguna cifra: solo un aviso genérico."
    : "No hay que hacer nada por ahora."
}

Aviso automático. No respondas a este correo. El importe es una estimación calculada al alza.
— ${product}`;

  return { subject, html, text };
}
