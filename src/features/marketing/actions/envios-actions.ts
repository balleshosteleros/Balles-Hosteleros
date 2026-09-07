"use server";

import { getMarketingContext } from "@/features/marketing/lib/supabase-context";
import { destinatariosDeCampana } from "@/features/marketing/lib/segmento-resolver";
import type { SegmentoJson } from "@/features/marketing/data/campanas";

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
