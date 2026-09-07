/**
 * Cron: las campañas que salen solas.
 *
 * Una pasada por hora. Cada empresa activa mira si a alguna de sus campañas le
 * toca salir AHORA según su reloj —el del restaurante, no el del servidor— y la
 * envía.
 *
 * Va cada hora y no una vez al día porque una campaña se programa a una hora
 * concreta ("el 24 de diciembre a las 11:00") y con una sola pasada diaria la
 * hora elegida no significaría nada.
 *
 * Autorización: Bearer ${CRON_SECRET}, como el resto de crons.
 */
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { procesarCampanasDeEmpresa } from "@/features/marketing/services/programador-campanas";
import type { SupabaseClient } from "@supabase/supabase-js";

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

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: empresas, error } = await admin
    .from("empresas")
    .select("id, nombre")
    .eq("estado", "Activa");
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const resultados = [];
  for (const empresa of empresas ?? []) {
    try {
      resultados.push(
        await procesarCampanasDeEmpresa(
          admin as unknown as SupabaseClient,
          empresa.id as string,
          (empresa.nombre as string) ?? "",
        ),
      );
    } catch (err) {
      // Una empresa que falla no puede llevarse por delante a las demás.
      resultados.push({
        empresa: empresa.nombre as string,
        error: err instanceof Error ? err.message : "Error",
      });
    }
  }

  return NextResponse.json({ ok: true, resultados });
}
