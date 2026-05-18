/**
 * Cron endpoint: descuenta stock por ventas del día anterior en Ágora POS.
 *
 * Se ejecuta cada día a las 08:00 (configurado en vercel.json).
 * Solo acepta llamadas con el header correcto de autorización de Vercel Cron
 * o con CRON_SECRET definido como variable de entorno.
 *
 * También puede llamarse manualmente desde el panel de logística.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { descontarStockPorVentasAgora } from "@/features/logistica/services/agora-ventas-sync";

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

  // ─── Obtener empresa_id de query param o env ───────────────────────────────
  const { searchParams } = new URL(request.url);
  const fecha = searchParams.get("fecha") ?? undefined; // YYYY-MM-DD, opcional
  const empresaIdParam = searchParams.get("empresa_id");

  // Si no se pasa empresa_id en el cron, buscar todas las empresas activas
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let empresaIds: string[] = [];

  if (empresaIdParam) {
    empresaIds = [empresaIdParam];
  } else {
    // Buscar todas las empresas activas que tengan productos con agora_id
    const { data: empresas } = await supabase
      .from("productos")
      .select("empresa_id")
      .not("agora_id", "is", null)
      .limit(100);

    const uniqueIds = new Set<string>();
    for (const e of empresas ?? []) {
      if (e.empresa_id) uniqueIds.add(e.empresa_id);
    }
    empresaIds = Array.from(uniqueIds);
  }

  if (empresaIds.length === 0) {
    return NextResponse.json({
      ok: true,
      mensaje: "Sin empresas con integración Ágora activa.",
      resultados: [],
    });
  }

  // ─── Ejecutar descuento para cada empresa ─────────────────────────────────
  const resultados = [];
  let hayErrores = false;

  for (const empresaId of empresaIds) {
    try {
      const result = await descontarStockPorVentasAgora(empresaId, null, fecha);
      resultados.push({
        empresaId,
        ...result,
      });
      if (!result.success) hayErrores = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      hayErrores = true;
      resultados.push({
        empresaId,
        success: false,
        error: msg,
      });
      console.error(`[cron/agora-sync] Error en empresa ${empresaId}:`, err);
    }
  }

  const httpStatus = hayErrores ? 207 : 200;
  return NextResponse.json(
    {
      ok: !hayErrores,
      ejecutadoEn: new Date().toISOString(),
      resultados,
    },
    { status: httpStatus }
  );
}
