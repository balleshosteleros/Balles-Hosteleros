/**
 * Cron: la campaña de cumpleaños.
 *
 * Una pasada al día por cada empresa activa. Quien cumpla años dentro de los
 * días de antelación configurados recibe su felicitación con su cupón.
 *
 * ── Por qué NO comprueba la hora local de la empresa ───────────────────────
 * Otros crons de la casa miran el reloj de cada empresa antes de actuar, y eso
 * los deja mudos en silencio si alguien cambia el `schedule` de `vercel.json`
 * sin recalcular la ventana (pasó con `bajas-efectivas`: meses sin dar de baja
 * a nadie). Aquí no hace falta ninguna ventana: lo que se calcula por empresa es
 * el DÍA en su zona horaria, no la hora. Se puede mover la hora del cron sin
 * romper nada.
 *
 * Autorización: Bearer ${CRON_SECRET}, como el resto de crons.
 */
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { procesarCumpleanosDeEmpresa } from "@/features/marketing/services/cumpleanos-runner";
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
      const r = await procesarCumpleanosDeEmpresa(
        admin as unknown as SupabaseClient,
        empresa.id as string,
      );
      resultados.push({ empresa: empresa.nombre as string, ...r });
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
