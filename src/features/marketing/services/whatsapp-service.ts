/**
 * Envío de campañas de WhatsApp vía WhatsApp Business Cloud API (Meta).
 * Usa fetch directamente.
 *
 * Endpoint: POST https://graph.facebook.com/v19.0/{phone_number_id}/messages
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * ENV requerido:
 *   WHATSAPP_ACCESS_TOKEN        → System User token con permisos whatsapp_business_messaging
 *   WHATSAPP_PHONE_NUMBER_ID     → ID del número emisor (panel WhatsApp Business)
 *   WHATSAPP_API_VERSION         → v19.0 (default)
 *
 * IMPORTANTE: para enviar mensajes plantilla (HSM) la plantilla debe estar
 * previamente aprobada en el WhatsApp Manager.
 *
 * ── A quién escribe ────────────────────────────────────────────────────────
 * A los clientes de sala que dieron permiso para recibir WhatsApp, y a nadie
 * más. Antes leía de una tabla `clientes` que no existe y, al no encontrarla,
 * caía a `usuarios`: una campaña comercial habría salido a los EMPLEADOS de la
 * empresa, sin permiso de nadie y sin dejar rastro.
 *
 * Cada envío queda registrado en `campanas_envios` con su cliente, que es lo
 * que hace que la campaña salga en las Comunicaciones de su ficha.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { destinatariosWhatsAppDeCampana } from "@/features/marketing/lib/segmento-resolver";
import type { CampanaWhatsApp } from "@/features/marketing/data/campanas";

const API_VERSION = process.env.WHATSAPP_API_VERSION ?? "v19.0";

export function isWhatsAppConfigured(): boolean {
  return !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export interface WhatsAppSendResult {
  success: boolean;
  enviados?: number;
  fallidos?: number;
  error?: string;
  jobId?: string;
}

export async function sendWhatsAppCampana(campana: CampanaWhatsApp): Promise<WhatsAppSendResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    return { success: false, error: "WhatsApp Cloud API no configurada" };
  }
  if (!campana.plantilla) {
    return { success: false, error: "Debes indicar el nombre de la plantilla aprobada por Meta" };
  }

  const admin = createAdminClient();

  let destinatarios: Array<{ id: string; telefono: string }>;
  try {
    destinatarios = await destinatariosWhatsAppDeCampana(
      admin,
      campana.empresaId,
      campana.segmentoJson,
    );
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al leer los clientes",
    };
  }

  if (destinatarios.length === 0) {
    return {
      success: false,
      error:
        "No hay ningún cliente al que escribir: el segmento está vacío o nadie ha dado permiso para recibir WhatsApp",
    };
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${phoneId}/messages`;

  // Construir los parámetros {{1}}, {{2}}... desde campana.variables
  const variablesOrdenadas = Object.entries(campana.variables ?? {})
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, v]) => ({ type: "text", text: v }));

  let enviados = 0;
  let fallidos = 0;
  const ahora = new Date().toISOString();
  const registros: Record<string, unknown>[] = [];

  for (const destinatario of destinatarios) {
    const tel = destinatario.telefono;
    const body: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to: tel,
      type: "template",
      template: {
        name: campana.plantilla,
        language: { code: campana.idioma || "es" },
        ...(variablesOrdenadas.length > 0 && {
          components: [{ type: "body", parameters: variablesOrdenadas }],
        }),
      },
    };
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        enviados++;
        registros.push({
          campana_id: campana.id,
          empresa_id: campana.empresaId,
          cliente_id: destinatario.id,
          destinatario: tel,
          estado: "enviado",
          enviado_en: ahora,
        });
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        fallidos++;
        registros.push({
          campana_id: campana.id,
          empresa_id: campana.empresaId,
          cliente_id: destinatario.id,
          destinatario: tel,
          estado: "fallido",
          error: err?.error?.message ?? `HTTP ${res.status}`,
        });
      }
    } catch (err) {
      fallidos++;
      registros.push({
        campana_id: campana.id,
        empresa_id: campana.empresaId,
        cliente_id: destinatario.id,
        destinatario: tel,
        estado: "fallido",
        error: err instanceof Error ? err.message : "Error de red",
      });
    }
  }

  // El registro se guarda pase lo que pase: es lo que hace que la campaña
  // aparezca en las Comunicaciones de cada cliente, y sin él no hay forma de
  // saber a quién llegó ni de reintentar solo con los que fallaron.
  for (let i = 0; i < registros.length; i += 500) {
    await admin.from("campanas_envios").insert(registros.slice(i, i + 500));
  }

  if (enviados === 0) {
    return { success: false, error: `Todos los envíos fallaron (${fallidos})`, enviados, fallidos };
  }

  return {
    success: true,
    enviados,
    fallidos,
    jobId: `wa-${Date.now()}`,
  };
}
