"use server";

import { revalidatePath } from "next/cache";
import { getMarketingContext } from "@/features/marketing/lib/supabase-context";
import { clienteIdsDelSegmento } from "@/features/marketing/lib/segmento-resolver";
import type { SegmentoJson } from "@/features/marketing/data/campanas";

/**
 * Envío en modo demo: persiste 1 fila en campanas_envios por cada cliente
 * que coincide con el segmento, marca la campaña como ejecutada.
 * NO llama a ningún proveedor externo (Resend/Twilio/WhatsApp).
 */
export async function enviarCampanaDemoAction(campanaId: string) {
  try {
    const { supabase, empresaId } = await getMarketingContext();
    if (!empresaId) return { ok: false as const, error: "Sin empresa", enviados: 0 };

    // Cargar campaña + verificar que es de esta empresa
    const { data: campana, error: errCampana } = await supabase
      .from("campanas_marketing")
      .select("id, empresa_id, canal, segmento_json, recurrencia_cron")
      .eq("id", campanaId)
      .eq("empresa_id", empresaId)
      .single();
    if (errCampana || !campana) return { ok: false as const, error: "Campaña no encontrada", enviados: 0 };

    const segmento = (campana.segmento_json as SegmentoJson) ?? { operador: "AND", condiciones: [] };
    const clientes = await clienteIdsDelSegmento(supabase, empresaId, segmento);
    if (!clientes.length) return { ok: false as const, error: "El segmento no tiene clientes", enviados: 0 };

    const ahora = new Date().toISOString();
    const filas = clientes.map((c) => ({
      campana_id: campanaId,
      empresa_id: empresaId,
      cliente_id: c.id,
      destinatario: campana.canal === "email" ? c.email : c.telefono,
      estado: "enviado",
      enviado_en: ahora,
    }));

    const { error: errInsert } = await supabase.from("campanas_envios").insert(filas);
    if (errInsert) throw errInsert;

    // Marcar como ejecutada (estado finalizada si una_vez)
    const nuevoEstado = campana.recurrencia_cron ? "activa" : "finalizada";
    await supabase
      .from("campanas_marketing")
      .update({ ultima_ejecucion: ahora, estado: nuevoEstado })
      .eq("id", campanaId)
      .eq("empresa_id", empresaId);

    revalidatePath("/marketing/campanas");
    return { ok: true as const, enviados: filas.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return { ok: false as const, error: msg, enviados: 0 };
  }
}
