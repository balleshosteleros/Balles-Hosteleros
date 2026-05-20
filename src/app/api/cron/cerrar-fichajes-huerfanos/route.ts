/**
 * Cron endpoint: cierra automáticamente fichajes que quedaron abiertos
 * (sin hora_salida) en días anteriores y deja la incidencia en su campo
 * propio. La tabla `fichajes` no admite un estado "incidencia".
 *
 * Se ejecuta a las 08:00 UTC (configurado en vercel.json).
 * Solo acepta llamadas con header `Authorization: Bearer ${CRON_SECRET}`.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/cerrar-fichajes-huerfanos] CRON_SECRET no configurado");
    return NextResponse.json({ error: "Configuración inválida" }, { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const hoy = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("fichajes")
    .update({
      estado: "completado",
      hora_salida: new Date().toISOString(),
      incidencia: "Fichaje sin cierre — pendiente de revisión",
    })
    .lt("fecha", hoy)
    .is("hora_salida", null)
    .in("estado", ["trabajando", "pausa"])
    .select("id, empresa_id, empleado_id, fecha");

  if (error) {
    console.error("[cron/cerrar-fichajes-huerfanos]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    ejecutadoEn: new Date().toISOString(),
    cerrados: data?.length ?? 0,
    fichajes: data ?? [],
  });
}
