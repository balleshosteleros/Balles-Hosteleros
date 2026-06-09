/**
 * Cron incremental cada 5 min: detecta cambios en cupos/reservas y publica
 * un delta del Availability Feed con solo los slots afectados.
 *
 * Para v1 simplificamos: si hubo CUALQUIER cambio en reserva_slots_lock o reservas
 * desde el último run exitoso, regeneramos el feed para los (empresa, fecha, turno)
 * tocados y subimos un fichero "availability_delta_<ts>.json".
 *
 * Schedule en vercel.json: cada 5 minutos.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadFeedSnapshot, makeCupoResolver } from "@/features/canales-google-rwg/lib/feed-builder";
import { uploadFeedsToActionsCenter } from "@/features/canales-google-rwg/lib/sftp-uploader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const HORA_DEFAULT_COMIDA = "14:00";
const HORA_DEFAULT_CENA = "21:00";
const DURATION_SEC = 5400;

function startSecParaFechaTurno(fechaISO: string, turno: "COMIDA" | "CENA"): number {
  const hora = turno === "COMIDA" ? HORA_DEFAULT_COMIDA : HORA_DEFAULT_CENA;
  const d = new Date(`${fechaISO}T${hora}:00+01:00`);
  return Math.floor(d.getTime() / 1000);
}

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
  const startedAt = new Date();

  // 1. ¿Cuándo fue el último run de availability (full o delta)?
  const { data: ultimo } = await admin
    .from("google_rwg_feed_runs")
    .select("iniciado_en")
    .in("feed_type", ["availability", "availability_delta"])
    .eq("estado", "ok")
    .order("iniciado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  const desde = ultimo?.iniciado_en
    ? new Date(ultimo.iniciado_en as string)
    : new Date(Date.now() - 60 * 60 * 1000); // primer run: última hora

  // 2. ¿Hubo cambios?
  const { data: locksChanged } = await admin
    .from("reserva_slots_lock")
    .select("empresa_id, fecha, turno")
    .gt("updated_at", desde.toISOString());

  const { data: reservasChanged } = await admin
    .from("reservas")
    .select("empresa_id, fecha, turno")
    .gt("updated_at", desde.toISOString());

  type TocadoKey = string; // empresa|fecha|turno
  const tocados = new Map<TocadoKey, { empresaId: string; fecha: string; turno: "COMIDA" | "CENA" }>();
  for (const r of (locksChanged ?? []) as Array<{ empresa_id: string; fecha: string; turno: string }>) {
    if (r.turno !== "COMIDA" && r.turno !== "CENA") continue;
    tocados.set(`${r.empresa_id}|${r.fecha}|${r.turno}`, {
      empresaId: r.empresa_id, fecha: r.fecha, turno: r.turno,
    });
  }
  for (const r of (reservasChanged ?? []) as Array<{ empresa_id: string; fecha: string; turno: string }>) {
    if (r.turno !== "COMIDA" && r.turno !== "CENA") continue;
    tocados.set(`${r.empresa_id}|${r.fecha}|${r.turno}`, {
      empresaId: r.empresa_id, fecha: r.fecha, turno: r.turno,
    });
  }

  if (tocados.size === 0) {
    return NextResponse.json({ ok: true, changes: 0, skipped: "no_changes" });
  }

  // 3. Snapshot ligero solo de empresas con place_id involucradas
  const snapshot = await loadFeedSnapshot(admin);
  const placeIdByEmpresaId = new Map(snapshot.empresas.map((e) => [e.empresaId, e.placeId]));
  const empresasActivas = new Set(snapshot.empresas.map((e) => e.empresaId));

  // 4. Generar el delta — solo slots tocados de empresas con place_id
  const resolveCupo = makeCupoResolver(admin);
  const slots: Array<Record<string, unknown>> = [];
  for (const t of tocados.values()) {
    if (!empresasActivas.has(t.empresaId)) continue;
    const placeId = placeIdByEmpresaId.get(t.empresaId)!;
    const cupo = await resolveCupo(t.empresaId, t.fecha, t.turno);
    const ocupado = snapshot.ocupacion.get(`${t.empresaId}|${t.fecha}|${t.turno}`) ?? 0;
    const ilimitado = cupo == null;
    slots.push({
      merchant_id: placeId,
      service_id: `${placeId}::${t.turno}`,
      start_sec: startSecParaFechaTurno(t.fecha, t.turno),
      duration_sec: DURATION_SEC,
      spots_total: ilimitado ? 999 : cupo,
      spots_open: ilimitado ? 999 : Math.max(0, cupo - ocupado),
    });
  }

  if (slots.length === 0) {
    return NextResponse.json({ ok: true, changes: tocados.size, skipped: "no_active_empresas" });
  }

  const ts = startedAt.toISOString().replace(/-/g, "").replace(/:/g, "").replace(/\./g, "").slice(0, 15);
  const [up] = await uploadFeedsToActionsCenter([
    { remoteFileName: `availability_delta_${ts}.json`, body: { slot: slots } },
  ]);

  await admin.from("google_rwg_feed_runs").insert({
    feed_type: "availability_delta",
    iniciado_en: startedAt.toISOString(),
    finalizado_en: new Date().toISOString(),
    estado: up.ok ? "ok" : "fallido",
    bytes: up.bytes,
    empresas_count: snapshot.empresas.length,
    slots_count: slots.length,
    sftp_remote: up.remotePath ?? null,
    errores_json: up.ok ? null : { error: up.error ?? "unknown_error" },
  });

  return NextResponse.json({
    ok: up.ok,
    changes: tocados.size,
    slots: slots.length,
    dryRun: up.dryRun,
    error: up.error,
  });
}
