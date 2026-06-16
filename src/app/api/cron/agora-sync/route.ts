/**
 * Cron diario: ingiere las ventas del día anterior de Ágora POS hacia
 * pos_tickets / pos_ticket_lineas (visibles en /sala/ventas) y recalcula el
 * precio de venta medio ponderado. PRP-056.
 *
 * Configurado en vercel.json (tras el cierre de caja). Fail-closed con CRON_SECRET.
 * Puede llamarse manual con ?fecha=YYYY-MM-DD (reprocesa ese business-day).
 *
 * ⚠️ Producción: requiere AGORA_API_URL / AGORA_API_TOKEN en Vercel (pendientes).
 */
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ingerirVentasAgoraDia,
  EMPRESA_WORKPLACE,
} from "@/features/logistica/services/agora-ventas-ingesta";
import { descontarStockPorTicket } from "@/features/sala/pos/services/descontar-stock-por-ventas";
import { revertirMovimientosPorDocumento } from "@/features/logistica/services/kardex";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function ayerIso(): string {
  const d = new Date(Date.now() - 86_400_000);
  return d.toISOString().slice(0, 10);
}

/**
 * Descuenta el stock de las ventas de un business-day vía kardex, SOLO si la fecha
 * está dentro de la ventana de descuento de la empresa (empresas.stock_descuento_desde).
 * El histórico anterior al corte NO se toca. Reproceso seguro: revierte los movimientos
 * previos del ticket antes de volver a descontar (las líneas se recrean con ids nuevos).
 */
async function descontarDiaSiCorte(
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

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/agora-sync] CRON_SECRET no configurado");
    return NextResponse.json({ error: "Configuración inválida" }, { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const businessDay = searchParams.get("fecha") ?? ayerIso();
  const empresaFiltro = searchParams.get("empresa_id");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const empresaIds = (empresaFiltro ? [empresaFiltro] : Object.keys(EMPRESA_WORKPLACE)).filter(
    (id) => EMPRESA_WORKPLACE[id] != null,
  );

  const resultados: Array<Record<string, unknown>> = [];
  let hayErrores = false;

  for (const empresaId of empresaIds) {
    try {
      const r = await ingerirVentasAgoraDia(supabase, empresaId, businessDay);
      // Descontar stock vía kardex (solo desde la fecha de corte de la empresa).
      const desc = await descontarDiaSiCorte(supabase, empresaId, businessDay);
      await supabase.from("agora_sync_log").insert({
        empresa_id: empresaId,
        status: "ok",
        total_records: r.facturas,
        ok_records: r.facturas,
        error_records: 0,
        sales_data: {
          dia: businessDay,
          facturas: r.facturas,
          lineas: r.lineas,
          lineas_sin_producto: r.sinProducto,
          stock: desc,
        },
      });
      resultados.push({ empresaId, ...r, stock: desc });
    } catch (err) {
      hayErrores = true;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron/agora-sync] empresa ${empresaId}:`, msg);
      await supabase.from("agora_sync_log").insert({
        empresa_id: empresaId,
        status: "error",
        error_message: msg,
        sales_data: { dia: businessDay },
      });
      resultados.push({ empresaId, error: msg });
    }
  }

  // Recalcular precio de venta medio (ventana 12 meses) tras la ingesta
  let precioMedioActualizados: number | null = null;
  if (!hayErrores) {
    const { data, error } = await supabase.rpc("recalcular_precio_venta_medio");
    if (error) console.error("[cron/agora-sync] recalcular_precio_venta_medio:", error.message);
    else precioMedioActualizados = data as number;
  }

  return NextResponse.json(
    { ok: !hayErrores, businessDay, ejecutadoEn: new Date().toISOString(), precioMedioActualizados, resultados },
    { status: hayErrores ? 207 : 200 },
  );
}
