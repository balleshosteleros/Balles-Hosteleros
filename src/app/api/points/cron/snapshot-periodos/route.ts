/**
 * /api/toques/cron/snapshot-periodos
 *
 * Invocado por Vercel Cron a las 00:05 diario (ver vercel.json).
 * Por defecto evalúa el día anterior y aplica los cierres que correspondan
 * (siempre día; semana si domingo; mes/trimestre/año si último día).
 *
 * Query opcionales:
 *  ?fecha=YYYY-MM-DD            → forzar fecha de evaluación (default = ayer)
 *  ?simular=dia,semana,mes,...  → forzar periodos a aplicar
 *
 * Idempotente: unique constraint en toques_ganadores y unique index
 * uniq_toques_mov_bonus_periodo aseguran que volver a correr no duplica.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ejecutarSnapshotsPeriodos } from "@/features/toques/services/snapshots.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Periodo = "dia" | "semana" | "mes" | "trimestre" | "ano";
const PERIODOS_VALIDOS: Periodo[] = ["dia", "semana", "mes", "trimestre", "ano"];

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const fromVercel = req.headers.get("x-vercel-cron");
  return auth === `Bearer ${expected}` || fromVercel === "1";
}

function ayerISO(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const fecha = url.searchParams.get("fecha") ?? ayerISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ ok: false, error: "fecha inválida (YYYY-MM-DD)" }, { status: 400 });
  }
  const simulado = url.searchParams.get("simular");
  let forzar: Periodo[] | undefined;
  if (simulado) {
    const parts = simulado.split(",").map((s) => s.trim()) as Periodo[];
    forzar = parts.filter((p) => PERIODOS_VALIDOS.includes(p));
    if (!forzar.length) forzar = undefined;
  }

  try {
    const admin = createAdminClient();
    const report = await ejecutarSnapshotsPeriodos(admin, fecha, forzar);
    return NextResponse.json({ ok: true, report });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[toques:cron:snapshot-periodos]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
