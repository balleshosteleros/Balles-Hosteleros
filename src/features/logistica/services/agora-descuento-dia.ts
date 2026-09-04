import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { descontarStockPorTicket } from "@/features/sala/pos/services/descontar-stock-por-ventas";
import { revertirMovimientosPorDocumento } from "@/features/logistica/services/kardex";

/**
 * Descuento de stock de un business-day de Ágora, por el KARDEX.
 *
 * ORIGEN ÚNICO DE VERDAD: `pos_ticket_lineas`. Esta función **no llama a la API de
 * Ágora**: trabaja sobre lo que la ingesta diaria (`agora-ventas-ingesta.ts`) ya
 * dejó en la base de datos.
 *
 * POR QUÉ ESTÁ AQUÍ Y NO DENTRO DEL CRON (03-sep): vivía dentro de
 * `src/app/api/cron/agora-sync/route.ts`, así que el reproceso manual de un día
 * (`sincronizarDiaAgora`, botón de la UI) NO pasaba por ella: re-ingería el día
 * —lo que borra y recrea las líneas con ids NUEVOS— sin revertir antes el kardex.
 * Con el descuento activo eso dejaría los movimientos viejos huérfanos (su
 * `origen_linea_id` apuntando a líneas que ya no existen) y volvería a descontar
 * encima. Compartiendo esta función, cron y reproceso manual son el mismo camino.
 *
 * Historia previa: hubo un segundo camino (`agora-ventas-sync.ts`) que llamaba a
 * `GET /api/export/tickets?businessDay=` — un endpoint que devuelve SIEMPRE
 * `{"Tickets":[]}` con HTTP 200, así que el descuento no saltaba nunca y nadie se
 * enteraba porque no daba error. Se retiró entero el 03-sep.
 */
export async function descontarDiaSiCorte(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  empresaId: string,
  businessDay: string,
): Promise<{ aplicado: boolean; tickets: number; movimientos: number; corte: string | null }> {
  const { data: emp } = await supabase
    .from("empresas")
    .select("stock_descuento_desde")
    .eq("id", empresaId)
    .single();
  const corte = (emp?.stock_descuento_desde as string | null) ?? null;
  // Sin corte configurado el descuento está apagado A PROPÓSITO (hoy es el caso):
  // no se activa hasta que las recetas cuadren y se guarden los complementos
  // (Addins) que hoy no se registran. Descontar antes daría números falsos.
  if (!corte || businessDay < corte) {
    return { aplicado: false, tickets: 0, movimientos: 0, corte };
  }

  const { data: tks } = await supabase
    .from("pos_tickets")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("origen", "agora")
    .gte("cerrado_at", `${businessDay}T00:00:00`)
    .lte("cerrado_at", `${businessDay}T23:59:59`);

  let movimientos = 0;
  for (const t of tks ?? []) {
    const ticketId = t.id as string;
    // Reproceso: deshacer movimientos previos (no-op si no había) y re-descontar limpio.
    // La reversión va por `documento_id` (= el id del ticket, que el upsert conserva),
    // no por los ids de línea, que la ingesta recrea.
    await revertirMovimientosPorDocumento({
      empresaId,
      documentoTipo: "pos_ticket",
      documentoId: ticketId,
    });
    await supabase.from("pos_tickets").update({ stock_descontado: false }).eq("id", ticketId);
    const r = await descontarStockPorTicket(supabase, ticketId, 1);
    movimientos += r.ingredientesAfectados;
  }
  return { aplicado: true, tickets: (tks ?? []).length, movimientos, corte };
}
