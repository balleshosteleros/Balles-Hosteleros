/**
 * /api/points/cron/cumpleanos
 *
 * Una pasada al día por cada empresa activa: felicita a quien cumple años hoy y
 * le apunta sus points. Todo lo manda la regla «Cumpleaños» de Points; aquí solo
 * se recorre la lista de empresas.
 *
 * Va aparte del devengo diario (que corre de madrugada, a las 23:55 de Madrid)
 * porque una felicitación de cumpleaños a las doce menos cinco de la noche no es
 * una felicitación. Esta sale a media mañana.
 *
 * NO mira la hora local de la empresa, solo el día en su zona horaria: se puede
 * cambiar la hora del `schedule` en `vercel.json` sin que el cron se quede mudo.
 *
 * Autorización: Bearer ${CRON_SECRET}, como el resto de crons.
 * Acepta `?empresa=<uuid>` para probar una sola empresa.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { procesarCumpleanosDeEmpresa } from "@/features/toques/services/cumpleanos.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function autorizado(req: NextRequest): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${esperado}` || req.headers.get("x-vercel-cron") === "1";
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const soloEmpresa = new URL(req.url).searchParams.get("empresa");

  let query = admin.from("empresas").select("id, nombre").eq("estado", "Activa");
  if (soloEmpresa) query = query.eq("id", soloEmpresa);
  const { data: empresas, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const resultados = [];
  for (const empresa of empresas ?? []) {
    try {
      const r = await procesarCumpleanosDeEmpresa(admin, empresa.id as string);
      resultados.push({ empresa: empresa.nombre as string, ...r });
    } catch (err) {
      // Una empresa que falla no puede dejar sin felicitación a las demás.
      resultados.push({
        empresa: empresa.nombre as string,
        error: err instanceof Error ? err.message : "Error",
      });
    }
  }

  return NextResponse.json({ ok: true, ejecutadoEn: new Date().toISOString(), resultados });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
