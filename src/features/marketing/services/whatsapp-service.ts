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
 */

import { createAdminClient } from "@/lib/supabase/admin";
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

async function obtenerTelefonos(empresaId: string, segmento: string): Promise<string[]> {
  const admin = createAdminClient();
  const telefonos = new Set<string>();

  // Primero busca en `clientes` (si existe).
  try {
    const { data: clientes } = await admin
      .from("clientes")
      .select("telefono, segmento")
      .eq("empresa_id", empresaId)
      .limit(500);
    for (const c of clientes ?? []) {
      if (!c.telefono) continue;
      if (segmento === "todos" || c.segmento === segmento) {
        telefonos.add(String(c.telefono).replace(/\s+/g, ""));
      }
    }
  } catch {
    // tabla clientes no existe aún
  }

  // Fallback: teléfonos en profiles
  if (telefonos.size === 0) {
    const { data: profiles } = await admin
      .from("usuarios")
      .select("telefono")
      .eq("empresa_id", empresaId)
      .limit(500);
    for (const p of profiles ?? []) {
      if (p.telefono) telefonos.add(String(p.telefono).replace(/\s+/g, ""));
    }
  }

  return Array.from(telefonos);
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

  const destinatarios = await obtenerTelefonos(campana.empresaId, campana.segmento);
  if (destinatarios.length === 0) {
    return { success: false, error: "No hay teléfonos en el segmento seleccionado" };
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${phoneId}/messages`;

  // Construir los parámetros {{1}}, {{2}}... desde campana.variables
  const variablesOrdenadas = Object.entries(campana.variables ?? {})
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, v]) => ({ type: "text", text: v }));

  let enviados = 0;
  let fallidos = 0;

  for (const tel of destinatarios) {
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
      if (res.ok) enviados++;
      else fallidos++;
    } catch {
      fallidos++;
    }
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
