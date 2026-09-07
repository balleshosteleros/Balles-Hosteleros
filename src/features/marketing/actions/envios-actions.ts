"use server";

import { revalidatePath } from "next/cache";
import { getMarketingContext } from "@/features/marketing/lib/supabase-context";
import { clienteIdsDelSegmento, destinatariosDeCampana } from "@/features/marketing/lib/segmento-resolver";
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
      .select("id, empresa_id, canal, segmento_json, recurrencia_cron, payload")
      .eq("id", campanaId)
      .eq("empresa_id", empresaId)
      .single();
    if (errCampana || !campana) return { ok: false as const, error: "Campaña no encontrada", enviados: 0 };

    // La de cumpleaños no admite ni siquiera la prueba: el motor diario mira
    // estos mismos registros para saber a quién ya felicitó este año, así que
    // una prueba dejaría a toda la base marcada como felicitada y nadie
    // recibiría nada hasta el año que viene.
    if ((campana.payload as Record<string, unknown> | null)?.claveSeed === "CUMPLEANOS") {
      return {
        ok: false as const,
        error:
          "La campaña de cumpleaños se envía sola, una por persona el día que le toca. " +
          "Probarla aquí marcaría a todos los clientes como ya felicitados.",
        enviados: 0,
      };
    }

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

/**
 * Cuántas personas recibirían la campaña AHORA MISMO.
 *
 * No es el número de clientes con correo: es el de los que además dieron permiso
 * para recibir publicidad, sin repetidos. Se enseña antes de enviar porque es la
 * única cifra que importa para decidir, y porque la diferencia con "clientes de
 * la casa" suele ser grande y conviene verla.
 */
export async function contarDestinatariosAction(campanaId: string) {
  try {
    const { supabase, empresaId } = await getMarketingContext();
    if (!empresaId) return { ok: false as const, total: 0, error: "Sin empresa" };

    const { data: campana } = await supabase
      .from("campanas_marketing")
      .select("segmento_json")
      .eq("id", campanaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!campana) return { ok: false as const, total: 0, error: "Campaña no encontrada" };

    const segmento = (campana.segmento_json as SegmentoJson) ?? { operador: "AND", condiciones: [] };
    const destinatarios = await destinatariosDeCampana(supabase, empresaId, segmento);
    return { ok: true as const, total: destinatarios.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return { ok: false as const, total: 0, error: msg };
  }
}
