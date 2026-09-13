/**
 * Cron diario: ingiere las ventas del día anterior de Ágora POS hacia
 * pos_tickets / pos_ticket_lineas (visibles en /gerencia/ventas) y recalcula el
 * precio de venta medio ponderado. PRP-056.
 *
 * Configurado en vercel.json (tras el cierre de caja). Fail-closed con CRON_SECRET.
 * Puede llamarse manual con ?fecha=YYYY-MM-DD (reprocesa ese business-day).
 *
 * ⚠️ Producción: requiere AGORA_API_URL / AGORA_API_TOKEN en Vercel (pendientes).
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  ingerirVentasAgoraDia,
  EMPRESA_WORKPLACE,
} from "@/features/logistica/services/agora-ventas-ingesta";
import { getAgoraCredenciales } from "@/features/logistica/services/agora-credenciales";
import { descontarDiaSiCorte } from "@/features/logistica/services/agora-descuento-dia";
import { recalcularVentasDiaPromedio } from "@/features/logistica/services/ventas-dia-promedio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function ayerIso(): string {
  const d = new Date(Date.now() - 86_400_000);
  return d.toISOString().slice(0, 10);
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

  // Empresas a sincronizar: las que tienen el conector Ágora activo en BD
  // (camino definitivo) ∪ las del mapa legacy (fallback de transición). PRP-059.
  let empresaIds: string[];
  if (empresaFiltro) {
    empresaIds = [empresaFiltro];
  } else {
    const { data: activas } = await supabase
      .from("empresas")
      .select("id")
      .eq("agora_activo", true);
    const ids = new Set<string>([
      ...(activas ?? []).map((e) => e.id as string),
      ...Object.keys(EMPRESA_WORKPLACE),
    ]);
    empresaIds = Array.from(ids);
  }

  const resultados: Array<Record<string, unknown>> = [];
  let hayErrores = false;

  for (const empresaId of empresaIds) {
    try {
      const conexion = await getAgoraCredenciales(supabase, empresaId);
      if (!conexion) {
        // Sin Ágora configurado ni por BD ni por fallback → se salta sin error.
        resultados.push({ empresaId, omitida: "sin credenciales de Ágora" });
        continue;
      }
      const r = await ingerirVentasAgoraDia(supabase, empresaId, businessDay, conexion);
      // Descontar stock vía kardex (solo desde la fecha de corte de la empresa).
      const desc = await descontarDiaSiCorte(supabase, empresaId, businessDay);
      // Media de consumo diario por producto: alimenta la sugerencia de pedido
      // "por ventas". Un fallo aquí no debe tumbar la ingesta, que es lo crítico.
      let ventasDia: Record<string, unknown> | { error: string };
      try {
        ventasDia = { ...(await recalcularVentasDiaPromedio(supabase, empresaId)) };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[cron/agora-sync] ventas_dia_promedio empresa ${empresaId}:`, msg);
        ventasDia = { error: msg };
      }
      // ⛔ AVISO DESACTIVADO (13-09-2026, a petición de Iván).
      //
      // POR QUÉ: la pantalla de avisos (`NotificacionesGate`) saca en un diálogo MODAL
      // **todas** las notificaciones sin ver, una detrás de otra, sin mirar de qué tipo
      // son. Con 21 productos pendientes eso le salía a la gente como 21 ventanas que
      // hay que ir cerrando antes de poder trabajar. Un aviso que impide trabajar deja
      // de ser un aviso.
      //
      // El error fue mío: di por hecho que una notificación normal iba a la campana y
      // que solo bloqueaban algunos tipos. No es así: la cola es incondicional.
      //
      // QUÉ HACER PARA REACTIVARLO: que el aviso llegue a la campana **sin** entrar en
      // esa cola modal (o que la cola filtre por tipo). Mientras tanto, lo pendiente se
      // ve igual y sin molestar a nadie en dos sitios: el contador del panel de Ágora en
      // el escritorio de Logística, y la propia pantalla Logística → Altas de Ágora.
      //
      // Además está apagado por el interruptor de Ajustes → Herramientas →
      // Notificaciones en las tres empresas, así que hacen falta las dos cosas para que
      // vuelva: quitar este comentario Y encenderlo ahí.
      const avisos: Record<string, unknown> = { desactivado: "bloqueaba la pantalla" };

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
          lineas_sin_product_id: r.lineasSinId,
          addins: r.addins,
          addins_sin_producto: r.addinsSinProducto,
          stock: desc,
          ventas_dia: ventasDia,
          altas_pendientes: avisos,
        },
      });
      resultados.push({ empresaId, ...r, stock: desc, ventasDia });
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
