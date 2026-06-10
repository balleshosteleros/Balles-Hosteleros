/**
 * Cron endpoint: espejo de stock Ágora → Balles.
 *
 * Se ejecuta cada día a las 08:00 UTC (configurado en vercel.json) y refleja
 * en la tabla `stock` las existencias actuales que lleva Ágora por almacén
 * (Opción A: Ágora es la fuente de verdad de catálogo y stock).
 *
 * Sustituye al flujo heredado ventas→descuento (2026-06-10): aquel apuntaba a
 * un endpoint inexistente y quedó superado por el espejo. Ver
 * docs/AGORA_INTEGRACION_ESTADO_Y_PLAN.md.
 *
 * Solo acepta llamadas con `Authorization: Bearer CRON_SECRET` (fail-closed).
 * También puede dispararse manualmente desde el panel de logística (server action).
 */

import { NextResponse } from "next/server";
import {
  ALMACEN_AGORA_POR_EMPRESA,
  espejoStockAgora,
  espejoStockAgoraTodas,
} from "@/features/logistica/services/agora-stock-mirror";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  // ─── Validar autorización del cron (fail-closed) ──────────────────────────
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/agora-sync] CRON_SECRET no configurado");
    return NextResponse.json({ error: "Configuración inválida" }, { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // ─── Empresa concreta (query param) o todas las mapeadas ──────────────────
  const { searchParams } = new URL(request.url);
  const empresaIdParam = searchParams.get("empresa_id");

  if (empresaIdParam && !ALMACEN_AGORA_POR_EMPRESA[empresaIdParam]) {
    return NextResponse.json(
      { error: `La empresa ${empresaIdParam} no tiene almacén de Ágora asociado.` },
      { status: 400 }
    );
  }

  try {
    if (empresaIdParam) {
      const result = await espejoStockAgora(empresaIdParam, null);
      return NextResponse.json(
        {
          ok: result.success,
          ejecutadoEn: new Date().toISOString(),
          resultados: [{ empresaId: empresaIdParam, ...result }],
        },
        { status: result.success ? 200 : 207 }
      );
    }

    const { ok, resultados } = await espejoStockAgoraTodas(null);
    return NextResponse.json(
      { ok, ejecutadoEn: new Date().toISOString(), resultados },
      { status: ok ? 200 : 207 }
    );
  } catch (err) {
    // Regla Seguridad Ágora: error exacto, sin reintentos automáticos
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cron/agora-sync] Error inesperado:", err);
    return NextResponse.json(
      { ok: false, ejecutadoEn: new Date().toISOString(), error: msg },
      { status: 500 }
    );
  }
}
