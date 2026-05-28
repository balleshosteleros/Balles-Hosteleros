/**
 * Cron cada 60s: procesa la cola `google_rwg_notificaciones` y empuja a la
 * Partner Notification API. Schedule en vercel.json: `* * * * *`.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchPendingNotifs } from "@/features/canales-google-rwg/lib/notif-dispatcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "config_invalid" }, { status: 503 });
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (process.env.GOOGLE_RWG_ENABLED !== "true") {
    return NextResponse.json({ ok: true, skipped: "rwg_disabled" });
  }

  const admin = createAdminClient();
  const result = await dispatchPendingNotifs(admin);
  return NextResponse.json({ ok: true, ...result });
}
