/**
 * Mailer genérico del módulo de Reservas.
 *
 * Único punto de entrada para enviar cualquier correo de reserva (confirmación,
 * reconfirmación, recordatorio, cancelación). Lee la plantilla personalizada
 * de la empresa, fusiona con los defaults de fábrica y renderiza un HTML con
 * la imagen de marca (logo + color primario).
 *
 * Server-only: usa la admin client para leer datos.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import {
  getReservaEmailPlantillaSeed,
  RESERVA_EMAIL_TIPO_LABELS,
  type ReservaEmailTipo,
} from "@/lib/seeds/reserva-email-plantillas";

type Admin = ReturnType<typeof createAdminClient>;

const AUDIT_COL: Record<ReservaEmailTipo, string | null> = {
  CONFIRMACION: "email_confirmacion_at",
  RECONFIRMACION: "email_reconfirmacion_at",
  RECORDATORIO: "email_recordatorio_at",
  CANCELACION: "email_cancelacion_at",
  POLITICA_AVISO: null, // bloque añadido al de confirmación → sin auditoría propia
  CUPON_PAGADO: null,
};

const HEADLINE_POR_TIPO: Record<ReservaEmailTipo, string> = {
  CONFIRMACION: "Reserva confirmada",
  RECONFIRMACION: "Reconfírmanos tu reserva",
  RECORDATORIO: "Recordatorio de tu reserva",
  CANCELACION: "Reserva cancelada",
  POLITICA_AVISO: "Política de cancelación",
  CUPON_PAGADO: "Pago recibido",
};

const BADGE_POR_TIPO: Record<ReservaEmailTipo, string> = {
  CONFIRMACION: "Reserva confirmada",
  RECONFIRMACION: "Por confirmar",
  RECORDATORIO: "Recordatorio",
  CANCELACION: "Cancelada",
  POLITICA_AVISO: "Política de cancelación",
  CUPON_PAGADO: "Pago recibido",
};

type EmpresaRow = {
  nombre: string;
  logo_url: string | null;
  isotipo_url: string | null;
  color: string | null;
  color_secundario: string | null;
};

type ReservaRow = {
  cliente_nombre: string | null;
  cliente_email: string | null;
  fecha: string;
  hora: string;
  personas: number;
  mesa: string | null;
  zona: string | null;
  notas: string | null;
  tipo_categoria: string | null;
  garantia_importe: number | null;
  importe_pagado: number | null;
  codigo: string | null;
  codigo_id: string | null;
};

type ConfigRow = {
  cancelacion_horas_antes: number | null;
  cancelacion_importe_eur: number | null;
  cancelacion_personalizar_mensaje: boolean | null;
  cancelacion_mensaje_personalizado: string | null;
};

type PlantillaRow = {
  activa: boolean;
  asunto_personalizado: string | null;
  mensaje_personalizado: string | null;
};

export type EnviarReservaEmailResult =
  | { ok: true; transport: string; idempotente?: false }
  | { ok: true; idempotente: true } // ya enviado, no se reenvía
  | { ok: false; error: string };

/**
 * Lee plantilla + reserva + empresa y envía el correo del tipo solicitado.
 *
 * - Idempotencia: si `force=false` y la columna de auditoría ya tiene timestamp,
 *   NO reenvía y devuelve `{ ok: true, idempotente: true }`.
 * - Si la plantilla está marcada como inactiva por la empresa, devuelve
 *   `{ ok: false, error: "plantilla inactiva" }`.
 * - POLITICA_AVISO y CUPON_PAGADO no se envían como correo aparte: si se llaman
 *   directamente, devuelven error explicativo.
 */
export async function enviarReservaEmail(
  reservaId: string,
  tipo: ReservaEmailTipo,
  options: { force?: boolean } = {},
): Promise<EnviarReservaEmailResult> {
  if (tipo === "POLITICA_AVISO" || tipo === "CUPON_PAGADO") {
    return {
      ok: false,
      error: `El tipo ${tipo} es un bloque del correo de confirmación, no se envía aparte.`,
    };
  }

  const admin = createAdminClient();
  const { data: reservaData, error: errR } = await admin
    .from("reservas")
    .select(
      "empresa_id, cliente_nombre, cliente_email, fecha, hora, personas, mesa, zona, notas, tipo_categoria, garantia_importe, importe_pagado, codigo, codigo_id, email_confirmacion_at, email_reconfirmacion_at, email_recordatorio_at, email_cancelacion_at",
    )
    .eq("id", reservaId)
    .maybeSingle();
  if (errR) return { ok: false, error: errR.message };
  if (!reservaData) return { ok: false, error: "Reserva no encontrada" };

  const empresaId = reservaData.empresa_id as string;
  const reserva: ReservaRow = {
    cliente_nombre: (reservaData.cliente_nombre as string | null) ?? null,
    cliente_email: (reservaData.cliente_email as string | null) ?? null,
    fecha: reservaData.fecha as string,
    hora: reservaData.hora as string,
    personas: reservaData.personas as number,
    mesa: (reservaData.mesa as string | null) ?? null,
    zona: (reservaData.zona as string | null) ?? null,
    notas: (reservaData.notas as string | null) ?? null,
    tipo_categoria: (reservaData.tipo_categoria as string | null) ?? null,
    garantia_importe: (reservaData.garantia_importe as number | null) ?? null,
    importe_pagado: (reservaData.importe_pagado as number | null) ?? null,
    codigo: (reservaData.codigo as string | null) ?? null,
    codigo_id: (reservaData.codigo_id as string | null) ?? null,
  };

  const email = (reserva.cliente_email ?? "").trim();
  if (!email) return { ok: false, error: "El cliente no tiene email" };

  // Idempotencia: si ya hay timestamp en la columna del tipo, no reenviar.
  const auditCol = AUDIT_COL[tipo];
  if (auditCol && !options.force) {
    const yaEnviado = reservaData[auditCol as keyof typeof reservaData] as
      | string
      | null;
    if (yaEnviado) return { ok: true, idempotente: true };
  }

  const [{ data: empresaData }, { data: configData }, { data: plantillaData }] =
    await Promise.all([
      admin
        .from("empresas")
        .select("nombre, logo_url, isotipo_url, color, color_secundario")
        .eq("id", empresaId)
        .maybeSingle(),
      admin
        .from("empresa_reservas_config")
        .select(
          "cancelacion_horas_antes, cancelacion_importe_eur, cancelacion_personalizar_mensaje, cancelacion_mensaje_personalizado",
        )
        .eq("empresa_id", empresaId)
        .maybeSingle(),
      admin
        .from("reserva_email_plantillas")
        .select("activa, asunto_personalizado, mensaje_personalizado")
        .eq("empresa_id", empresaId)
        .eq("tipo", tipo)
        .maybeSingle(),
    ]);

  const empresa: EmpresaRow = {
    nombre: (empresaData?.nombre as string | undefined) ?? "",
    logo_url: (empresaData?.logo_url as string | null | undefined) ?? null,
    isotipo_url: (empresaData?.isotipo_url as string | null | undefined) ?? null,
    color: (empresaData?.color as string | null | undefined) ?? null,
    color_secundario:
      (empresaData?.color_secundario as string | null | undefined) ?? null,
  };

  const config: ConfigRow = {
    cancelacion_horas_antes:
      (configData?.cancelacion_horas_antes as number | null | undefined) ??
      null,
    cancelacion_importe_eur:
      (configData?.cancelacion_importe_eur as number | null | undefined) ??
      null,
    cancelacion_personalizar_mensaje:
      (configData?.cancelacion_personalizar_mensaje as
        | boolean
        | null
        | undefined) ?? null,
    cancelacion_mensaje_personalizado:
      (configData?.cancelacion_mensaje_personalizado as
        | string
        | null
        | undefined) ?? null,
  };

  const plantilla: PlantillaRow = {
    activa: (plantillaData?.activa as boolean | undefined) ?? true,
    asunto_personalizado:
      (plantillaData?.asunto_personalizado as string | null | undefined) ??
      null,
    mensaje_personalizado:
      (plantillaData?.mensaje_personalizado as string | null | undefined) ??
      null,
  };

  if (!plantilla.activa) {
    return { ok: false, error: "Plantilla desactivada por la empresa" };
  }

  // ---- Sustitución de placeholders --------------------------------------------------
  const fechaLegible = formatearFecha(reserva.fecha);
  const horaLegible = (reserva.hora ?? "").slice(0, 5);
  const personasTxt = `${reserva.personas} ${reserva.personas === 1 ? "persona" : "personas"}`;
  const placeholders: Record<string, string> = {
    nombre: primerNombre(reserva.cliente_nombre) || "",
    nombre_completo: reserva.cliente_nombre || "",
    empresa: empresa.nombre,
    fecha: fechaLegible,
    hora: horaLegible,
    personas: String(reserva.personas),
    mesa: reserva.mesa ?? "",
    zona: reserva.zona ? capitalizar(reserva.zona) : "",
  };

  const seed = getReservaEmailPlantillaSeed(tipo);
  const asuntoBase =
    plantilla.asunto_personalizado ?? seed?.asunto_default ?? "";
  const mensajeBase =
    plantilla.mensaje_personalizado ?? seed?.mensaje_default ?? "";
  const subject = sustituir(asuntoBase, placeholders) || HEADLINE_POR_TIPO[tipo];
  const mensajeLibre = sustituir(mensajeBase, placeholders);

  // ---- Bloques añadidos (política, cupón) solo en CONFIRMACION ----------------------
  let politicaBloque: { horas: number; importe: number; mensajeExtra: string } | null = null;
  let cuponBloque: { importeEur: number; mensajeExtra: string } | null = null;
  let cuponCanjeadoBloque: { codigo: string; tituloCliente: string } | null = null;
  if (tipo === "CONFIRMACION") {
    if (
      reserva.tipo_categoria === "politica" &&
      config.cancelacion_horas_antes &&
      config.cancelacion_importe_eur
    ) {
      // El texto extra de POLITICA_AVISO viene de la plantilla (personalizada o default)
      const { data: politicaTpl } = await admin
        .from("reserva_email_plantillas")
        .select("mensaje_personalizado")
        .eq("empresa_id", empresaId)
        .eq("tipo", "POLITICA_AVISO")
        .maybeSingle();
      const seedPol = getReservaEmailPlantillaSeed("POLITICA_AVISO");
      const mensajeExtra = sustituir(
        ((politicaTpl?.mensaje_personalizado as string | null) ??
          seedPol?.mensaje_default ??
          ""),
        placeholders,
      );
      politicaBloque = {
        horas: config.cancelacion_horas_antes,
        importe: Number(config.cancelacion_importe_eur),
        mensajeExtra,
      };
    }
    if (reserva.tipo_categoria === "cupon" && reserva.importe_pagado != null) {
      const { data: cuponTpl } = await admin
        .from("reserva_email_plantillas")
        .select("mensaje_personalizado")
        .eq("empresa_id", empresaId)
        .eq("tipo", "CUPON_PAGADO")
        .maybeSingle();
      const seedCp = getReservaEmailPlantillaSeed("CUPON_PAGADO");
      const mensajeExtra = sustituir(
        ((cuponTpl?.mensaje_personalizado as string | null) ??
          seedCp?.mensaje_default ??
          ""),
        placeholders,
      );
      cuponBloque = {
        importeEur: Number(reserva.importe_pagado),
        mensajeExtra,
      };
    }
    if (reserva.codigo_id && reserva.codigo) {
      const { data: cuponRow } = await admin
        .from("reserva_codigos")
        .select("titulo_interno, titulo_cliente")
        .eq("id", reserva.codigo_id)
        .maybeSingle();
      const titulo = (cuponRow?.titulo_cliente as string | null) ?? (cuponRow?.titulo_interno as string | null) ?? "";
      cuponCanjeadoBloque = { codigo: reserva.codigo, tituloCliente: titulo };
    }
  }

  // ---- Render HTML / texto ---------------------------------------------------------
  const html = renderHtml({
    tipo,
    empresa,
    cliente: placeholders.nombre,
    fechaLegible,
    horaLegible,
    personasTxt,
    mesa: reserva.mesa,
    zona: reserva.zona ? capitalizar(reserva.zona) : null,
    observaciones: reserva.notas,
    mensajeLibre,
    politicaBloque,
    cuponBloque,
    cuponCanjeadoBloque,
  });
  const text = renderText({
    tipo,
    empresa: empresa.nombre,
    cliente: placeholders.nombre,
    fechaLegible,
    horaLegible,
    personasTxt,
    mesa: reserva.mesa,
    zona: reserva.zona ? capitalizar(reserva.zona) : null,
    observaciones: reserva.notas,
    mensajeLibre,
    politicaBloque,
    cuponBloque,
    cuponCanjeadoBloque,
  });

  const res = await sendEmail({
    to: email,
    subject,
    html,
    text,
  });

  if (!res.ok) {
    if (!res.configured) {
      return { ok: false, error: "SMTP no configurado" };
    }
    return { ok: false, error: res.error };
  }

  // Auditoría
  if (auditCol) {
    await admin
      .from("reservas")
      .update({ [auditCol]: new Date().toISOString() })
      .eq("id", reservaId);
  }
  return { ok: true, transport: res.transport };
}

// ────────────────────────────────────────────────────────────────────────────
// Render HTML
// ────────────────────────────────────────────────────────────────────────────

interface RenderInput {
  tipo: ReservaEmailTipo;
  empresa: EmpresaRow;
  cliente: string;
  fechaLegible: string;
  horaLegible: string;
  personasTxt: string;
  mesa: string | null;
  zona: string | null;
  observaciones: string | null;
  mensajeLibre: string;
  politicaBloque: { horas: number; importe: number; mensajeExtra: string } | null;
  cuponBloque: { importeEur: number; mensajeExtra: string } | null;
  cuponCanjeadoBloque: { codigo: string; tituloCliente: string } | null;
}

function renderHtml(input: RenderInput): string {
  const primario = sanitizarHex(input.empresa.color) ?? "#0f172a";
  const primarioOscuro = oscurecerHex(primario, 0.15);
  const textoSobrePrimario = colorContraste(primario);
  const empresaNombre = input.empresa.nombre || "";

  // Prefiere el isotipo (icono) de la empresa; si no hay, el logo completo; si
  // tampoco, el nombre en texto.
  const marcaSrc = input.empresa.isotipo_url || input.empresa.logo_url;
  const cabeceraHtml = marcaSrc
    ? `<img src="${escapeAttr(marcaSrc)}" alt="${escapeAttr(empresaNombre)}" style="max-height:60px;max-width:220px;display:block;margin:0 auto;" />`
    : `<div style="font-size:22px;font-weight:700;color:${textoSobrePrimario};letter-spacing:0.2px;">${escapeHtml(empresaNombre)}</div>`;

  const filas: string[] = [
    fila("Fecha", input.fechaLegible),
    fila("Hora", input.horaLegible),
    fila("Comensales", input.personasTxt),
  ];
  if (input.zona) filas.push(fila("Zona", input.zona));
  if (input.mesa) filas.push(fila("Mesa", `Mesa ${input.mesa}`));

  const greeting = input.cliente
    ? `${input.tipo === "CANCELACION" ? "Hola" : "¡Te esperamos"}${input.tipo === "CANCELACION" ? "," : ","} ${escapeHtml(input.cliente)}${input.tipo === "CANCELACION" ? "" : "!"}`
    : input.tipo === "CANCELACION"
      ? "Hola,"
      : "¡Te esperamos!";

  const bloquePolitica = input.politicaBloque
    ? `<div style="margin-top:14px;padding:14px 16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;font-size:13px;color:#7c2d12;line-height:1.6;">
        <div style="font-weight:700;margin-bottom:4px;">Política de cancelación</div>
        Cancelaciones con menos de <strong>${input.politicaBloque.horas} h</strong> de antelación o no presentación: se cobrará <strong>${formatearImporte(input.politicaBloque.importe)} €</strong>.
        ${input.politicaBloque.mensajeExtra ? `<div style="margin-top:6px;">${nl2br(escapeHtml(input.politicaBloque.mensajeExtra))}</div>` : ""}
      </div>`
    : "";

  const bloqueCupon = input.cuponBloque
    ? `<div style="margin-top:14px;padding:14px 16px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;font-size:13px;color:#064e3b;line-height:1.6;">
        <div style="font-weight:700;margin-bottom:4px;">Pago recibido</div>
        Ya tienes pagados <strong>${formatearImporte(input.cuponBloque.importeEur)} €</strong> por adelantado. Trae este correo el día de la reserva.
        ${input.cuponBloque.mensajeExtra ? `<div style="margin-top:6px;">${nl2br(escapeHtml(input.cuponBloque.mensajeExtra))}</div>` : ""}
      </div>`
    : "";

  const bloqueCuponCanjeado = input.cuponCanjeadoBloque
    ? `<div style="margin-top:14px;padding:14px 16px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;font-size:13px;color:#78350f;line-height:1.6;">
        <div style="text-transform:uppercase;font-size:11px;letter-spacing:0.6px;color:#92400e;font-weight:700;">Cupón aplicado</div>
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:18px;font-weight:700;color:#7c2d12;margin-top:4px;">${escapeHtml(input.cuponCanjeadoBloque.codigo)}</div>
        <div style="margin-top:2px;">${escapeHtml(input.cuponCanjeadoBloque.tituloCliente)}</div>
      </div>`
    : "";

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,0.08);">
            <tr>
              <td align="center" style="padding:28px 32px;background:linear-gradient(135deg, ${primario} 0%, ${primarioOscuro} 100%);">
                ${cabeceraHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 8px 32px;text-align:center;">
                <div style="display:inline-block;padding:4px 12px;background:${withAlpha(primario, 0.1)};color:${primario};border-radius:9999px;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">${BADGE_POR_TIPO[input.tipo]}</div>
                <h1 style="margin:14px 0 4px 0;font-size:26px;font-weight:700;color:#0f172a;line-height:1.25;">${greeting}</h1>
                <p style="margin:0;font-size:13px;color:#64748b;">${subtitulo(input.tipo)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 8px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                  <tr>
                    <td style="padding:18px 20px;background:${withAlpha(primario, 0.04)};text-align:center;border-bottom:1px solid #e2e8f0;">
                      <div style="font-size:11px;color:#64748b;letter-spacing:0.5px;text-transform:uppercase;font-weight:600;">${escapeHtml(input.fechaLegible)}</div>
                      <div style="margin-top:4px;font-size:34px;font-weight:700;color:${primario};line-height:1;letter-spacing:-0.5px;">${escapeHtml(input.horaLegible)}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 20px 10px 20px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                        ${filas.join("\n")}
                      </table>
                    </td>
                  </tr>
                </table>
                ${
                  input.observaciones
                    ? `<div style="margin-top:14px;padding:12px 14px;background:#f8fafc;border-left:3px solid ${primario};border-radius:6px;">
                        <div style="font-size:11px;color:#64748b;font-weight:600;letter-spacing:0.4px;text-transform:uppercase;margin-bottom:4px;">Observaciones</div>
                        <div style="font-size:13px;color:#334155;line-height:1.55;">${escapeHtml(input.observaciones)}</div>
                      </div>`
                    : ""
                }
                ${
                  input.mensajeLibre
                    ? `<div style="margin-top:14px;padding:14px 16px;background:${withAlpha(primario, 0.06)};border-radius:8px;font-size:13px;color:#334155;line-height:1.6;">${nl2br(escapeHtml(input.mensajeLibre))}</div>`
                    : ""
                }
                ${bloquePolitica}
                ${bloqueCupon}
                ${bloqueCuponCanjeado}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 28px 32px;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;text-align:center;">
                  ${footerSegunTipo(input.tipo)}
                  ${empresaNombre ? `<br/><strong style="color:#475569;">${escapeHtml(empresaNombre)}</strong>` : ""}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderText(input: Omit<RenderInput, "empresa"> & { empresa: string }): string {
  const lineas = [
    `${HEADLINE_POR_TIPO[input.tipo]} · ${input.empresa}`,
    ``,
    `${input.cliente ? `Hola ${input.cliente},` : "Hola,"}`,
    `- Fecha: ${input.fechaLegible}`,
    `- Hora: ${input.horaLegible}`,
    `- Comensales: ${input.personasTxt}`,
  ];
  if (input.zona) lineas.push(`- Zona: ${input.zona}`);
  if (input.mesa) lineas.push(`- Mesa: ${input.mesa}`);
  if (input.observaciones) lineas.push(``, `Observaciones: ${input.observaciones}`);
  if (input.mensajeLibre) lineas.push(``, input.mensajeLibre);
  if (input.politicaBloque) {
    lineas.push(
      ``,
      `Política de cancelación: ${input.politicaBloque.horas} h de antelación, ${formatearImporte(input.politicaBloque.importe)} € si no.`,
    );
    if (input.politicaBloque.mensajeExtra) lineas.push(input.politicaBloque.mensajeExtra);
  }
  if (input.cuponBloque) {
    lineas.push(``, `Pago recibido: ${formatearImporte(input.cuponBloque.importeEur)} €.`);
    if (input.cuponBloque.mensajeExtra) lineas.push(input.cuponBloque.mensajeExtra);
  }
  if (input.cuponCanjeadoBloque) {
    lineas.push(
      ``,
      `Cupón aplicado: ${input.cuponCanjeadoBloque.codigo} - ${input.cuponCanjeadoBloque.tituloCliente}`,
    );
  }
  lineas.push(``, footerSegunTipo(input.tipo, true));
  return lineas.join("\n");
}

function subtitulo(t: ReservaEmailTipo): string {
  switch (t) {
    case "CONFIRMACION":
      return "Gracias por reservar con nosotros.";
    case "RECONFIRMACION":
      return "Por favor, confírmanos que mantienes la reserva.";
    case "RECORDATORIO":
      return "Te esperamos pronto.";
    case "CANCELACION":
      return "Tu reserva ha sido cancelada.";
    default:
      return "";
  }
}

function footerSegunTipo(t: ReservaEmailTipo, plain = false): string {
  switch (t) {
    case "CONFIRMACION":
      return plain
        ? "Si necesitas cancelar o modificar, responde a este correo."
        : "¿Necesitas cancelar o modificar la reserva? Responde a este correo y te ayudamos.";
    case "RECONFIRMACION":
      return plain
        ? "Responde a este correo para confirmar."
        : "Responde a este correo para confirmar tu asistencia.";
    case "RECORDATORIO":
      return plain
        ? "Si ya no puedes venir, responde a este correo."
        : "Si finalmente no puedes venir, avísanos respondiendo a este correo.";
    case "CANCELACION":
      return plain
        ? "Si fue un error, responde a este correo."
        : "Si crees que es un error, responde a este correo y lo revisamos.";
    default:
      return "";
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers visuales y de texto
// ────────────────────────────────────────────────────────────────────────────

function fila(etiqueta: string, valor: string): string {
  return `<tr>
    <td style="padding:6px 0;font-size:12px;color:#64748b;width:42%;">${etiqueta}</td>
    <td style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:600;text-align:right;">${escapeHtml(valor)}</td>
  </tr>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

function nl2br(s: string): string {
  return s.replace(/\n/g, "<br/>");
}

function capitalizar(s: string): string {
  if (!s) return s;
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function primerNombre(s: string | null | undefined): string {
  if (!s) return "";
  return s.split(" ")[0] || "";
}

function formatearFecha(iso: string): string {
  try {
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatearImporte(eur: number): string {
  return eur.toFixed(2).replace(/\./, ",");
}

function sustituir(plantilla: string, vars: Record<string, string>): string {
  return plantilla.replace(/{{\s*(\w+)\s*}}/g, (_, k) => vars[k] ?? "");
}

function sanitizarHex(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(v.trim());
  return m ? `#${m[1].toLowerCase()}` : null;
}

function oscurecerHex(hex: string, ratio: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const mix = (c: number) => Math.max(0, Math.round(c * (1 - ratio)));
  const out = (mix(r) << 16) | (mix(g) << 8) | mix(b);
  return `#${out.toString(16).padStart(6, "0")}`;
}

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

function colorContraste(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "#0f172a" : "#ffffff";
}

// ────────────────────────────────────────────────────────────────────────────
// Preview público (usado por la UI de Comunicaciones para el editor en vivo).
// No envía nada — solo devuelve el HTML que vería el cliente con datos de
// ejemplo. Por eso no toca BD.
// ────────────────────────────────────────────────────────────────────────────

export interface PreviewInput {
  tipo: ReservaEmailTipo;
  empresaNombre: string;
  logoUrl: string | null;
  isotipoUrl?: string | null;
  colorPrimario: string | null;
  asuntoOverride: string | null;
  mensajeOverride: string | null;
  config: {
    cancelacionHorasAntes?: number | null;
    cancelacionImporteEur?: number | null;
  };
}

export function previewReservaEmail(input: PreviewInput): {
  subject: string;
  html: string;
} {
  const placeholders: Record<string, string> = {
    nombre: "María",
    nombre_completo: "María García",
    empresa: input.empresaNombre || "Tu restaurante",
    fecha: formatearFecha("2026-06-15"),
    hora: "21:00",
    personas: "4",
    mesa: "12",
    zona: "Terraza",
  };
  const seed = getReservaEmailPlantillaSeed(input.tipo);
  const asunto = sustituir(
    input.asuntoOverride ?? seed?.asunto_default ?? "",
    placeholders,
  );
  const mensajeLibre = sustituir(
    input.mensajeOverride ?? seed?.mensaje_default ?? "",
    placeholders,
  );

  const politicaBloque =
    input.tipo === "CONFIRMACION" &&
    input.config.cancelacionHorasAntes &&
    input.config.cancelacionImporteEur
      ? {
          horas: input.config.cancelacionHorasAntes,
          importe: Number(input.config.cancelacionImporteEur),
          mensajeExtra: "",
        }
      : null;

  const html = renderHtml({
    tipo: input.tipo,
    empresa: {
      nombre: input.empresaNombre || "Tu restaurante",
      logo_url: input.logoUrl,
      isotipo_url: input.isotipoUrl ?? null,
      color: input.colorPrimario,
      color_secundario: null,
    },
    cliente: placeholders.nombre,
    fechaLegible: placeholders.fecha,
    horaLegible: placeholders.hora,
    personasTxt: `${placeholders.personas} personas`,
    mesa: placeholders.mesa,
    zona: placeholders.zona,
    observaciones: null,
    mensajeLibre,
    politicaBloque,
    cuponBloque: null,
    cuponCanjeadoBloque: null,
  });
  return { subject: asunto || RESERVA_EMAIL_TIPO_LABELS[input.tipo], html };
}

// Re-export para que el sync seed pueda hacer un check sin importar dos veces.
export type _Admin = Admin;
