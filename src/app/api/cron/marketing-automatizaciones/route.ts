/**
 * Cron de Marketing → Automatizaciones.
 *
 * Dos trabajos en la misma pasada, y en este orden:
 *   1. Barrer: mirar qué ha pasado y anotar los disparos nuevos.
 *   2. Avanzar: mover un paso las ejecuciones a las que ya les toca.
 *
 * Primero barrer y luego avanzar hace que un disparo sin espera —un aviso al
 * departamento por una valoración baja— salga en la MISMA pasada en la que se
 * detecta, en lugar de esperar diez minutos más.
 *
 * Autorización: Bearer ${CRON_SECRET}, como el resto de crons.
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { rowToAutomatizacion } from "@/features/marketing/data/automatizaciones";
import { barrerAutomatizacion } from "@/features/marketing/services/automatizaciones-barrido";
import { procesarPendientes } from "@/features/marketing/services/automatizaciones-motor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await db
    .from("marketing_automatizaciones")
    .select("*")
    .eq("estado", "Activo");

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let disparosNuevos = 0;
  for (const row of data ?? []) {
    disparosNuevos += await barrerAutomatizacion(db, rowToAutomatizacion(row));
  }

  const tirada = await procesarPendientes(db);

  return NextResponse.json({
    ok: true,
    automatizacionesActivas: (data ?? []).length,
    disparosNuevos,
    ...tirada,
  });
}
