/**
 * Envío de campañas de SMS.
 *
 * No habla con Twilio directamente: pasa por el orquestador de mensajería
 * (`lib/mensajeria/enviar`), que es la única puerta por la que sale un mensaje
 * de pago. Eso trae gratis tres cosas que una campaña necesita y que un envío
 * directo no tendría:
 *
 *   - **Se cobra del monedero de la empresa** y se devuelve si el mensaje no
 *     sale. Una campaña de SMS a mil personas es dinero de verdad.
 *   - **El tope mensual de gasto** frena una campaña disparada por error aunque
 *     el monedero esté lleno.
 *   - Cada mensaje queda en `mensajeria_envios` con su coste y su estado de
 *     entrega.
 *
 * Y aquí encima se registra en `campanas_envios`, que es lo que hace que la
 * campaña salga en las Comunicaciones de la ficha del cliente.
 *
 * ── El texto ──────────────────────────────────────────────────────────────
 * Se manda tal cual lo escribió el restaurante. El aviso de que pasa de 160
 * caracteres, o de que lleva tildes y se parte en dos mensajes cobrados aparte,
 * se da en el editor: aquí ya es tarde para arreglarlo y callarlo sería peor.
 */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { destinatariosSmsDeCampana } from "@/features/marketing/lib/segmento-resolver";
import { enviarMensaje } from "@/lib/mensajeria/enviar";
import type { CampanaSms } from "@/features/marketing/data/campanas";

export interface SmsSendResult {
  success: boolean;
  enviados?: number;
  fallidos?: number;
  error?: string;
}

export async function sendSmsCampana(campana: CampanaSms): Promise<SmsSendResult> {
  if (!campana.cuerpo?.trim()) {
    return { success: false, error: "La campaña no tiene mensaje" };
  }

  const admin = createAdminClient();

  let destinatarios: Array<{ id: string; telefono: string }>;
  try {
    destinatarios = await destinatariosSmsDeCampana(admin, campana.empresaId, campana.segmentoJson);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al leer los clientes",
    };
  }

  if (!destinatarios.length) {
    return {
      success: false,
      error:
        "No hay ningún cliente al que escribir: el segmento está vacío o nadie ha dado permiso para recibir SMS",
    };
  }

  const ahora = new Date().toISOString();
  const registros: Record<string, unknown>[] = [];
  let enviados = 0;
  let fallidos = 0;
  let primerMotivo = "";

  for (const d of destinatarios) {
    const r = await enviarMensaje({
      empresaId: campana.empresaId,
      tipo: "CAMPANA",
      telefono: d.telefono,
      textoSms: campana.cuerpo,
      actor: { origen: "AUTOMATICO" },
    });

    if (r.ok) {
      enviados++;
      registros.push({
        campana_id: campana.id,
        empresa_id: campana.empresaId,
        cliente_id: d.id,
        destinatario: d.telefono,
        estado: "enviado",
        enviado_en: ahora,
        proveedor_id: r.envioId,
      });
    } else {
      fallidos++;
      if (!primerMotivo) primerMotivo = r.motivo;
      registros.push({
        campana_id: campana.id,
        empresa_id: campana.empresaId,
        cliente_id: d.id,
        destinatario: d.telefono,
        estado: "fallido",
        error: r.motivo.slice(0, 500),
      });
    }
  }

  for (let i = 0; i < registros.length; i += 500) {
    await admin.from("campanas_envios").insert(registros.slice(i, i + 500));
  }

  if (!enviados) {
    return {
      success: false,
      // El motivo del primero explica el de todos: sin saldo, canal apagado o
      // mensajería sin dar de alta fallan igual para los mil.
      error: primerMotivo || "No se pudo enviar ningún SMS",
      enviados: 0,
      fallidos,
    };
  }

  return { success: true, enviados, fallidos };
}
