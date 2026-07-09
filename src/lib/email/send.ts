/**
 * Envío de correos transaccionales del sistema.
 *
 * Transporte (2026-05-29): SMTP único global vía nodemailer. Las credenciales
 * viven en variables de entorno (SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS),
 * nunca en BD ni en código.
 *
 * Política de respuestas (2026-06-06): TODOS los correos que envía la plataforma
 * son **no-reply**. El remitente es el software, así que nadie debe poder
 * "responder" a un correo del SaaS — ni empleados ni clientes. El Reply-To se
 * fija siempre a `EMAIL_NOREPLY` (una dirección que no se monitoriza: las
 * respuestas rebotan). Cualquier comunicación real se hace por los canales de la
 * propia empresa, no contestando al correo.
 *
 * Si faltan las env vars SMTP → { ok: false, configured: false } y el llamador
 * degrada con elegancia (nunca rompe el flujo de negocio).
 *
 * Server-only: usa nodemailer.
 */

import "server-only";
import nodemailer from "nodemailer";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchEmpresaBrand, brandHeaderHtml, brandHeaderInline, inyectarCabecera } from "@/lib/email/brand-header";

/** Dirección no-reply: capa cualquier respuesta a los correos del software. */
const NOREPLY =
  process.env.EMAIL_NOREPLY?.trim() || "no-reply@balleshosteleros.com";

/** Límite diario gratuito del transporte (Gmail Workspace, toda la plataforma). */
const LIMITE_DIARIO = 2000;
/** A partir de cuántos envíos del día avisamos al dueño (default 90% = 1.800). */
const UMBRAL_AVISO = Number(process.env.EMAIL_LIMITE_AVISO) || 1800;
/** Buzón al que llega el aviso de cercanía al límite. */
const DESTINO_ALERTAS =
  process.env.EMAIL_ALERTAS?.trim() || "balleshosteleros@gmail.com";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Copia (CC) opcional. Recibe una copia visible del correo. */
  cc?: string;
  /**
   * Nombre visible del remitente (display name). La dirección de correo sigue
   * siendo siempre la del SMTP de la plataforma; esto solo cambia el nombre que
   * ve el destinatario en su bandeja (p.ej. "HABANA <notificaciones@…>").
   */
  fromName?: string;
  /**
   * Empresa cuya cabecera corporativa (isotipo) se antepone al HTML del correo.
   * Si se omite, no se añade cabecera.
   */
  empresaId?: string;
  /**
   * Pon a `false` para NO anteponer la cabecera de marca aunque haya `empresaId`
   * (correos que ya construyen su propia cabecera, p.ej. reservas). Default: true.
   */
  brandHeader?: boolean;
  /**
   * Adjuntos opcionales (nodemailer). P.ej. el PDF de un pedido al proveedor.
   * `content` admite Buffer/Uint8Array o string. Aditivo: los llamadores que no
   * lo usan no se ven afectados.
   */
  attachments?: { filename: string; content: Buffer | Uint8Array | string; contentType?: string }[];
};

/** Extrae la dirección de un From que puede venir como "Nombre <email>" o "email". */
function addressOf(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim();
}

export type SendEmailResult =
  // `html` es el HTML EXACTO enviado (con cabecera de marca ya inyectada). Los
  // llamadores que necesiten archivar el correo recibido lo persisten verbatim.
  | { ok: true; transport: "smtp"; id?: string; html: string }
  | { ok: false; configured: false }
  | { ok: false; configured: true; error: string };

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

/**
 * Lee la configuración SMTP de las env vars. Devuelve null si falta cualquiera
 * de las obligatorias (host/user/pass): señal de "transporte no configurado".
 */
function resolverSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  // 465 → SSL implícito (secure=true); 587/25 → STARTTLS (secure=false).
  const port = Number(process.env.SMTP_PORT) || 465;
  // Override explícito con SMTP_SECURE=true|false si el proveedor lo requiere.
  const secure =
    process.env.SMTP_SECURE != null
      ? process.env.SMTP_SECURE === "true"
      : port === 465;
  // From: usa EMAIL_FROM si está definido; si no, el propio buzón autenticado.
  const from = process.env.EMAIL_FROM?.trim() || user;

  return { host, port, secure, user, pass, from };
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const cfg = resolverSmtpConfig();
  if (!cfg) return { ok: false, configured: false };

  // Reply-To siempre no-reply: nadie responde a un correo del software.
  const replyTo = NOREPLY;

  // Cabecera corporativa: antepone el isotipo de la empresa al HTML (best-effort:
  // si falla la lectura de marca, se envía el correo sin cabecera).
  // El logo se INCRUSTA como adjunto inline (cid:) para que Gmail/Outlook lo
  // muestren AUTOMÁTICAMENTE, sin el aviso «mostrar imágenes». Si la descarga
  // falla, se cae a la URL externa (comportamiento anterior).
  let html = input.html;
  const inlineAttachments: { filename: string; content: Buffer; cid: string; contentType: string }[] = [];
  // Nombre visible del remitente. Regla (2026-07-09): si el llamador NO fija un
  // `fromName`, pero el correo pertenece a una empresa (`empresaId`), el remitente
  // pasa a ser el NOMBRE DE LA EMPRESA (BACANAL, HABANA…), no "Balles Hosteleros".
  // Así todos los correos salen con la marca de la empresa de forma consistente
  // sin tocar cada llamador. Si no hay empresa, cae al display name de EMAIL_FROM.
  let fromName = input.fromName;
  if (input.empresaId) {
    const brand = await fetchEmpresaBrand(input.empresaId);
    if (brand) {
      if (!fromName && brand.nombre?.trim()) fromName = brand.nombre.trim();
      // Cabecera corporativa (isotipo): solo si no se pidió omitirla explícitamente.
      if (input.brandHeader !== false) {
        const inline = await brandHeaderInline(brand);
        if (inline) {
          html = inyectarCabecera(html, inline.html);
          inlineAttachments.push(inline.attachment);
        } else {
          html = inyectarCabecera(html, brandHeaderHtml(brand));
        }
      }
    }
  }

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    const info = await transporter.sendMail({
      from: fromName
        ? { name: fromName, address: addressOf(cfg.from) }
        : cfg.from,
      to: input.to,
      cc: input.cc || undefined,
      subject: input.subject,
      html,
      text: input.text,
      replyTo,
      attachments: [
        // Logo inline (cid:) — se muestra sin pedir «mostrar imágenes».
        ...inlineAttachments.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
          cid: a.cid,
        })),
        // Adjuntos normales que pase el llamador.
        ...(input.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content instanceof Uint8Array ? Buffer.from(a.content) : a.content,
          contentType: a.contentType,
        })) ?? []),
      ],
    });
    // Cuenta el envío y avisa si nos acercamos al límite diario (best-effort:
    // nunca rompe ni ralentiza de forma crítica el flujo de negocio).
    await registrarEnvioYAvisar();
    // Devuelve el HTML final (post cabecera de marca): el correo tal cual lo
    // recibe el destinatario, para que el llamador pueda archivarlo.
    return { ok: true, transport: "smtp", id: info.messageId, html };
  } catch (e) {
    return {
      ok: false,
      configured: true,
      error: e instanceof Error ? e.message : "Error SMTP desconocido",
    };
  }
}

/**
 * Incrementa el contador diario de correos y, la primera vez que se cruza el
 * umbral en el día, manda UN aviso al dueño. Todo dentro de try/catch: si algo
 * falla, el correo principal ya se envió y no queremos romper nada.
 *
 * El propio aviso vuelve a pasar por `sendEmail`, pero el RPC marca `alertado`
 * antes de enviarlo, así que no se genera un segundo aviso (sin bucle).
 */
async function registrarEnvioYAvisar(): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("registrar_envio_email", {
      p_umbral: UMBRAL_AVISO,
    });
    if (error || !data) return;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.debe_alertar) return;

    const { limiteEnviosEmail } = await import("./templates/limite-envios");
    const { subject, html, text } = limiteEnviosEmail({
      total: Number(row.total) || UMBRAL_AVISO,
      limite: LIMITE_DIARIO,
      umbral: UMBRAL_AVISO,
    });
    await sendEmail({ to: DESTINO_ALERTAS, subject, html, text });
  } catch (e) {
    console.error("[email] aviso límite diario:", e);
  }
}
