/**
 * Envío de las campañas de email vía la API de Resend.
 *
 * ── Por qué la API y no el SMTP del resto del software ─────────────────────
 * Los correos transaccionales (una confirmación, una nómina) salen de uno en uno
 * por `lib/email/send.ts`. Una campaña son miles de correos de golpe, cada uno
 * con su propio enlace de baja: por SMTP, uno a uno, tardaría horas. La API de
 * Resend acepta cien correos distintos por llamada. Misma cuenta, misma clave,
 * mismo remitente verificado.
 *
 * ── Lo que este archivo garantiza ──────────────────────────────────────────
 *  - Solo escribe a clientes de sala que dieron permiso (`acepta_marketing_email`).
 *  - Cada correo lleva SU enlace de baja, y la cabecera `List-Unsubscribe` para
 *    que Gmail pinte su propio botón de "cancelar suscripción". Sin eso, la
 *    salida del cliente es el botón de spam, que cuesta la reputación del
 *    dominio y acaba tirando también las confirmaciones de reserva.
 *  - Cada envío queda registrado en `campanas_envios`, con su error si falló.
 *  - El remitente es siempre el del software con el nombre del restaurante
 *    delante: es el dominio que tiene el DKIM verificado.
 *
 * ENV: `RESEND_API_KEY` y `EMAIL_FROM`.
 */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { destinatariosDeCampana } from "@/features/marketing/lib/segmento-resolver";
import { tokenDeBaja } from "./baja-marketing";
import type { CampanaEmail } from "@/features/marketing/data/campanas";

const RESEND_URL = "https://api.resend.com";
/** Tope de correos por llamada a `/emails/batch` que admite Resend. */
const POR_LOTE = 100;
/**
 * Espera entre lotes. Resend admite 10 llamadas por segundo; una campaña de seis
 * mil son sesenta llamadas seguidas y, sin freno, salen todas de golpe. 150 ms
 * dejan el ritmo en unas 7 por segundo, con margen, y alargan el envío entero
 * apenas diez segundos: barato a cambio de no perder un lote.
 */
const ESPERA_ENTRE_LOTES_MS = 150;
/** Reintentos de un lote rechazado por ir demasiado rápido. */
const REINTENTOS = 3;

function esperar(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
/** Marcador que el HTML de la campaña trae donde va el token de cada persona. */
const MARCADOR_BAJA = "{{TOKEN_BAJA}}";

export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export interface ResendSendResult {
  success: boolean;
  batchId?: string;
  enviados?: number;
  fallidos?: number;
  error?: string;
}

/** "Balles Hosteleros <notificaciones@…>" → "notificaciones@…" */
function direccionDe(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim();
}

/**
 * Remitente del envío. La dirección es SIEMPRE la del software —es el dominio
 * con SPF y DKIM verificados; escribir desde otra iría directo a spam—, con el
 * nombre del restaurante delante para que el cliente vea quién le escribe.
 */
function remitente(nombreEmpresa: string): string {
  const base = process.env.EMAIL_FROM?.trim() || "notificaciones@balleshosteleros.com";
  const direccion = direccionDe(base);
  const nombre = (nombreEmpresa || "").trim();
  return nombre ? `${nombre} <${direccion}>` : base;
}

/**
 * Un solo correo comercial, con su enlace de baja ya resuelto.
 *
 * Existe aparte del envío por lotes porque hay campañas que no salen de golpe:
 * la de cumpleaños manda un correo al día a quien le toca, y meter treinta
 * correos en la maquinaria del lote —con su troceado y su reintento por
 * bloques— sería montar un camión para llevar una caja.
 *
 * Lo que sí comparte, porque no es opcional en un correo comercial: el
 * remitente verificado y la cabecera `List-Unsubscribe`, que es lo que hace que
 * Gmail pinte su propio "cancelar suscripción" en vez de empujar al cliente al
 * botón de spam.
 */
export async function enviarCorreoMarketing(input: {
  empresaNombre: string;
  para: string;
  asunto: string;
  /** HTML con el token de baja YA sustituido. */
  html: string;
}): Promise<{ ok: true; proveedorId: string | null } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "Falta RESEND_API_KEY" };

  const enlaceBaja = urlBajaUnClic(input.html);

  try {
    const res = await fetch(`${RESEND_URL}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: remitente(input.empresaNombre),
        to: [input.para],
        subject: input.asunto,
        html: input.html,
        headers: enlaceBaja
          ? {
              "List-Unsubscribe": `<${enlaceBaja}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            }
          : undefined,
      }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      return { ok: false, error: err?.message ?? `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, proveedorId: data?.id ?? null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error de red" };
  }
}

export async function sendEmailCampana(campana: CampanaEmail): Promise<ResendSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { success: false, error: "Falta RESEND_API_KEY" };
  if (!campana.asunto?.trim()) return { success: false, error: "La campaña no tiene asunto" };
  if (!campana.cuerpoHtml?.trim()) return { success: false, error: "La campaña no tiene mensaje" };

  const admin = createAdminClient();

  const { data: empresa } = await admin
    .from("empresas")
    .select("nombre")
    .eq("id", campana.empresaId)
    .maybeSingle();

  let destinatarios: Array<{ id: string; email: string }>;
  try {
    destinatarios = await destinatariosDeCampana(admin, campana.empresaId, campana.segmentoJson);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Error al leer los clientes" };
  }

  if (!destinatarios.length) {
    return {
      success: false,
      error:
        "No hay ningún cliente al que escribir: el segmento está vacío o nadie ha dado permiso para recibir correos",
    };
  }

  const from = remitente((empresa?.nombre as string) ?? "");
  const ahora = new Date().toISOString();

  let enviados = 0;
  let fallidos = 0;
  let ultimoLote: string | undefined;
  const registros: Record<string, unknown>[] = [];

  for (let i = 0; i < destinatarios.length; i += POR_LOTE) {
    const lote = destinatarios.slice(i, i + POR_LOTE);

    const correos = lote.map((d) => {
      // Cada persona recibe SU enlace de baja: un enlace común no podría saber
      // a quién dar de baja al pulsarlo.
      const token = tokenDeBaja(d.id);
      const html = campana.cuerpoHtml.split(MARCADOR_BAJA).join(token);
      const enlaceBaja = urlBajaUnClic(html);

      return {
        from,
        to: [d.email],
        subject: campana.asunto,
        html,
        // Gmail y Outlook pintan su propio "cancelar suscripción" con esto, y
        // el de un solo clic evita que el cliente use el botón de spam.
        headers: enlaceBaja
          ? {
              "List-Unsubscribe": `<${enlaceBaja}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            }
          : undefined,
      };
    });

    try {
      if (i > 0) await esperar(ESPERA_ENTRE_LOTES_MS);

      // Un 429 significa "vas demasiado rápido", no "este correo está mal": el
      // mismo lote sale bien esperando un poco. Sin reintento, cien personas se
      // quedaban sin su correo por un problema de ritmo nuestro.
      let res = await fetch(`${RESEND_URL}/emails/batch`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(correos),
      });

      for (let intento = 1; intento <= REINTENTOS && res.status === 429; intento++) {
        // Cada espera dobla a la anterior: si el primer segundo no bastó, seguir
        // insistiendo al mismo ritmo tampoco va a bastar.
        await esperar(1000 * 2 ** (intento - 1));
        res = await fetch(`${RESEND_URL}/emails/batch`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(correos),
        });
      }

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        const msg = err?.message ?? `HTTP ${res.status}`;
        fallidos += lote.length;
        for (const d of lote) {
          registros.push({
            campana_id: campana.id,
            empresa_id: campana.empresaId,
            cliente_id: d.id,
            destinatario: d.email,
            estado: "fallido",
            error: msg,
          });
        }
        continue;
      }

      const data = (await res.json()) as { data?: { id: string }[] };
      const ids = data.data ?? [];
      ultimoLote = ids.at(-1)?.id ?? ultimoLote;
      enviados += lote.length;
      lote.forEach((d, j) => {
        registros.push({
          campana_id: campana.id,
          empresa_id: campana.empresaId,
          cliente_id: d.id,
          destinatario: d.email,
          estado: "enviado",
          enviado_en: ahora,
          proveedor_id: ids[j]?.id ?? null,
        });
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red";
      fallidos += lote.length;
      for (const d of lote) {
        registros.push({
          campana_id: campana.id,
          empresa_id: campana.empresaId,
          cliente_id: d.id,
          destinatario: d.email,
          estado: "fallido",
          error: msg,
        });
      }
    }
  }

  // El registro se guarda pase lo que pase: sin él no hay forma de saber a quién
  // llegó el correo ni de reintentar solo con los que fallaron.
  for (let i = 0; i < registros.length; i += 500) {
    await admin.from("campanas_envios").insert(registros.slice(i, i + 500));
  }

  if (!enviados) {
    return { success: false, error: "No se pudo enviar ningún correo", enviados: 0, fallidos };
  }

  return { success: true, batchId: ultimoLote, enviados, fallidos };
}

/**
 * Dirección que Gmail llama al pulsar SU botón de cancelar suscripción.
 *
 * No es la misma que la del pie del correo, y no puede serlo: ese botón no abre
 * una página, hace un POST silencioso y espera un 200. Por eso apunta a la ruta
 * de API, que responde a un POST.
 *
 * El token se saca del enlace que el correo ya lleva —es el último tramo de la
 * dirección, con o sin el nombre del local delante— para que la cabecera y el
 * pie no puedan hablar de clientes distintos.
 */
function urlBajaUnClic(html: string): string | null {
  const m = html.match(/https?:\/\/[^"'\s]*\/baja\/([^"'\s]+)/i);
  if (!m) return null;
  const token = m[1].split("/").pop();
  if (!token) return null;
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://sistema.balleshosteleros.com"
  ).replace(/\/$/, "");
  return `${base}/api/baja/${token}`;
}
