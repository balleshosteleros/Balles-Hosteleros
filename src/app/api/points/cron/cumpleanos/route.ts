/**
 * /api/points/cron/cumpleanos
 *
 * Una pasada al día: felicita a quien cumple años hoy y le apunta sus points en
 * cada una de sus empresas. Todo lo manda la regla «Cumpleaños» de Points, que
 * cada empresa enciende y dosifica por su cuenta.
 *
 * Va aparte del devengo diario (que corre de madrugada, a las 23:55 de Madrid)
 * porque una felicitación de cumpleaños a las doce menos cinco de la noche no es
 * una felicitación. Esta sale a media mañana.
 *
 * NO mira la hora local de la empresa, solo el día en su zona horaria: se puede
 * cambiar la hora del `schedule` en `vercel.json` sin que el cron se quede mudo.
 *
 * Autorización: Bearer ${CRON_SECRET}, como el resto de crons.
 *
 * Para comprobar cosas sin molestar a nadie:
 *   ?dry=1              calcula y enseña los mensajes, sin escribir ni avisar
 *   ?fecha=YYYY-MM-DD   finge que hoy es ese día (pruebas y repesca)
 *   ?empresa=<uuid>     una sola empresa
 */
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { procesarCumpleanosDelDia } from "@/features/toques/services/cumpleanos.service";

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

  const params = new URL(req.url).searchParams;
  const dry = params.get("dry") === "1";
  const fecha = params.get("fecha") ?? undefined;
  const empresaId = params.get("empresa") ?? undefined;
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ ok: false, error: "fecha inválida (YYYY-MM-DD)" }, { status: 400 });
  }

  try {
    const resumen = await procesarCumpleanosDelDia(createAdminClient(), { dry, fecha, empresaId });
    return NextResponse.json({
      ok: true,
      modoPrueba: dry,
      ejecutadoEn: new Date().toISOString(),
      ...resumen,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[points:cron:cumpleanos]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
