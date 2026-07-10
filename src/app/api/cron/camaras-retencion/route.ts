/**
 * Cron: retención rodante de 30 días para grabaciones de CÁMARAS.
 *
 * Cada día borra los clips de `camara_grabaciones` cuyo `inicio` tenga más de
 * 30 días: primero el objeto en R2, luego la fila. Así el almacenamiento no
 * crece sin fin (el día 31 se va cayendo el día 1) y la cuota por empresa se
 * libera sola.
 *
 * IMPORTANTE: SOLO afecta a `camara_grabaciones`. Las grabaciones de pantalla,
 * formación y onboarding (`recordings`) NO se tocan: esas se conservan.
 *
 * Schedule: 02:30 UTC diario (vercel.json).
 * Auth: Authorization: Bearer ${CRON_SECRET}.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { deleteObjectR2 } from "@/shared/lib/r2";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RETENCION_DIAS = 30;
// Techo de borrados por ejecución: evita timeouts si hay mucho acumulado; el
// resto se limpia en la siguiente pasada diaria.
const MAX_POR_EJECUCION = 2000;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/camaras-retencion] CRON_SECRET no configurado");
    return NextResponse.json({ error: "Configuración inválida" }, { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const corte = new Date(Date.now() - RETENCION_DIAS * 24 * 60 * 60 * 1000).toISOString();

  const { data: vencidos, error: selErr } = await admin
    .from("camara_grabaciones")
    .select("id, r2_key")
    .lt("inicio", corte)
    .order("inicio", { ascending: true })
    .limit(MAX_POR_EJECUCION);

  if (selErr) {
    console.error("[cron/camaras-retencion] select:", selErr.message);
    return NextResponse.json({ ok: false, error: selErr.message }, { status: 500 });
  }

  let borrados = 0;
  let fallosR2 = 0;
  for (const clip of vencidos ?? []) {
    // 1) Borrar el objeto en R2. Si falla, NO borramos la fila (reintentaremos
    //    mañana) para no perder la referencia y quedarnos con un huérfano en R2.
    try {
      await deleteObjectR2(clip.r2_key as string);
    } catch (e) {
      fallosR2++;
      console.warn("[cron/camaras-retencion] R2 delete falló:", clip.r2_key, e);
      continue;
    }
    // 2) Borrar la fila.
    const { error: delErr } = await admin.from("camara_grabaciones").delete().eq("id", clip.id);
    if (delErr) {
      console.warn("[cron/camaras-retencion] fila delete falló:", clip.id, delErr.message);
      continue;
    }
    borrados++;
  }

  return NextResponse.json({
    ok: true,
    corte,
    candidatos: vencidos?.length ?? 0,
    borrados,
    fallos_r2: fallosR2,
    truncado: (vencidos?.length ?? 0) >= MAX_POR_EJECUCION,
  });
}
