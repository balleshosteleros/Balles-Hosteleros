/**
 * /api/toques/cron/devengo-diario
 *
 * Invocado por Vercel Cron a las 23:55 diario (ver vercel.json).
 * Evalúa todas las reglas activas para la fecha indicada (default: hoy)
 * y otorga toques en `toques_movimientos`. Idempotente.
 *
 * Protegido con header `Authorization: Bearer ${CRON_SECRET}`.
 * Acepta `?fecha=YYYY-MM-DD` para backfill o test.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ejecutarReglasDelDia } from "@/features/toques/services/reglas-runner.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // Si no hay secret configurado, solo permitimos en dev local
    return process.env.NODE_ENV !== "production";
  }
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const fromVercel = req.headers.get("x-vercel-cron"); // header inyectado por Vercel Cron
  return auth === `Bearer ${expected}` || fromVercel === "1";
}

function fechaHoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const fecha = url.searchParams.get("fecha") ?? fechaHoyISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ ok: false, error: "fecha inválida (YYYY-MM-DD)" }, { status: 400 });
  }
  try {
    const admin = createAdminClient();
    const report = await ejecutarReglasDelDia(admin, fecha);
    return NextResponse.json({ ok: true, report });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[toques:cron:devengo-diario]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
