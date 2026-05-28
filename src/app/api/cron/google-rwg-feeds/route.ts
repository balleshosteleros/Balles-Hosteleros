/**
 * Cron diario: genera los 3 feeds (Merchant, Services, Availability) y los sube
 * por SFTP al Actions Center. Cada run deja una fila en `google_rwg_feed_runs`.
 *
 * Schedule: 0 4 * * * (04:00 UTC). Configurado en vercel.json.
 * Solo corre en producción; en staging/local hay que llamarlo con curl + secret.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildAvailabilityFeed,
  buildMerchantFeed,
  buildServicesFeed,
  loadFeedSnapshot,
  makeCupoResolver,
} from "@/features/canales-google-rwg/lib/feed-builder";
import { uploadFeedsToActionsCenter } from "@/features/canales-google-rwg/lib/sftp-uploader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type FeedType = "merchant" | "services" | "availability";

async function registrarRun(
  admin: ReturnType<typeof createAdminClient>,
  feedType: FeedType,
  startedAt: Date,
  bytes: number,
  empresasCount: number,
  slotsCount: number,
  ok: boolean,
  remotePath: string | null,
  errorMsg: string | null,
): Promise<void> {
  await admin.from("google_rwg_feed_runs").insert({
    feed_type: feedType,
    iniciado_en: startedAt.toISOString(),
    finalizado_en: new Date().toISOString(),
    estado: ok ? "ok" : "fallido",
    bytes,
    empresas_count: empresasCount,
    slots_count: slotsCount,
    sftp_remote: remotePath,
    errores_json: errorMsg ? { error: errorMsg } : null,
  });
}

export async function GET(request: Request) {
  // Auth del cron (mismo patrón que el resto)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/google-rwg-feeds] CRON_SECRET no configurado");
    return NextResponse.json({ error: "config_invalid" }, { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (process.env.GOOGLE_RWG_ENABLED !== "true") {
    return NextResponse.json({ ok: true, skipped: "rwg_disabled" });
  }

  const admin = createAdminClient();
  const startedAt = new Date();
  const snapshot = await loadFeedSnapshot(admin);
  const empresasCount = snapshot.empresas.length;

  if (empresasCount === 0) {
    await registrarRun(admin, "merchant", startedAt, 0, 0, 0, true, null, "no_empresas");
    return NextResponse.json({ ok: true, empresas: 0 });
  }

  // 1. Generar los 3 feeds
  const merchantFeed = buildMerchantFeed(snapshot);
  const servicesFeed = buildServicesFeed(snapshot);
  const { feed: availabilityFeed, slotsCount } = await buildAvailabilityFeed(snapshot, {
    resolveCupo: makeCupoResolver(admin),
  });

  // 2. Subir los 3 (sftp-uploader sabe hacer dry-run si faltan envs)
  const uploads = await uploadFeedsToActionsCenter([
    { remoteFileName: "merchant_feed.json", body: merchantFeed },
    { remoteFileName: "services_feed.json", body: servicesFeed },
    { remoteFileName: "availability_feed.json", body: availabilityFeed },
  ]);

  // 3. Auditar
  const feedTypes: FeedType[] = ["merchant", "services", "availability"];
  await Promise.all(
    uploads.map((u, i) =>
      registrarRun(
        admin,
        feedTypes[i],
        startedAt,
        u.bytes,
        empresasCount,
        feedTypes[i] === "availability" ? slotsCount : 0,
        u.ok,
        u.remotePath ?? null,
        u.ok ? null : (u.error ?? "unknown_error"),
      ),
    ),
  );

  return NextResponse.json({
    ok: uploads.every((u) => u.ok),
    empresas: empresasCount,
    slots: slotsCount,
    uploads: uploads.map((u) => ({ ok: u.ok, bytes: u.bytes, dryRun: u.dryRun, error: u.error })),
  });
}
