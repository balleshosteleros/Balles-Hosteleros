/**
 * Cron endpoint: hard-delete definitivo de las empresas marcadas para
 * eliminación (eliminacion_programada_at) cuyo periodo de gracia de 30 días
 * ya venció. Hasta ese momento la empresa sigue accesible internamente y la
 * eliminación se puede cancelar desde Ajustes → Empresa.
 *
 * Se ejecuta a diario (configurado en vercel.json).
 * Solo acepta llamadas con header `Authorization: Bearer ${CRON_SECRET}`.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RETENCION_DIAS = 30;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/empresas-purga] CRON_SECRET no configurado");
    return NextResponse.json({ error: "Configuración inválida" }, { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Límite: marcadas hace más de 30 días.
  const limite = new Date(Date.now() - RETENCION_DIAS * 24 * 60 * 60 * 1000).toISOString();

  const { data: vencidas, error: selErr } = await supabase
    .from("empresas")
    .select("id, nombre, eliminacion_programada_at")
    .not("eliminacion_programada_at", "is", null)
    .lt("eliminacion_programada_at", limite);

  if (selErr) {
    console.error("[cron/empresas-purga] select", selErr);
    return NextResponse.json({ ok: false, error: selErr.message }, { status: 500 });
  }

  const ids = (vencidas ?? []).map((e) => e.id as string);
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, ejecutadoEn: new Date().toISOString(), purgadas: 0 });
  }

  // Hard-delete definitivo (los FKs con ON DELETE CASCADE limpian el resto).
  const { error: delErr } = await supabase.from("empresas").delete().in("id", ids);
  if (delErr) {
    console.error("[cron/empresas-purga] delete", delErr);
    return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    ejecutadoEn: new Date().toISOString(),
    purgadas: ids.length,
    empresas: vencidas ?? [],
  });
}
