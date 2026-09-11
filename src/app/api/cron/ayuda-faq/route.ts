/**
 * Cron: escribe las preguntas frecuentes a partir de lo que pregunta la gente.
 *
 * Una vez por semana, los lunes. No hace falta más: una pregunta que se hace
 * tres veces no se hace tres veces en una tarde, y pasar todos los días
 * multiplicaría por siete el gasto de IA para publicar exactamente lo mismo.
 *
 * No depende de la hora local de cada empresa: no hay ninguna ventana que
 * cumplir, solo se mira una ventana de días hacia atrás. Por eso, al revés que
 * otros crons de la casa, aquí SÍ se puede cambiar la hora de `vercel.json` sin
 * recalcular nada.
 *
 * Cada empresa se procesa por separado y su resultado no toca a las demás.
 *
 * Solo acepta llamadas con `Authorization: Bearer ${CRON_SECRET}`.
 */
import { NextResponse } from "next/server";
import { generarFaqsTodasLasEmpresas } from "@/features/soporte/services/generar-faqs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/ayuda-faq] CRON_SECRET no configurado");
    return NextResponse.json({ error: "Configuración inválida" }, { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultados = await generarFaqsTodasLasEmpresas();

  return NextResponse.json({
    ok: true,
    ejecutadoEn: new Date().toISOString(),
    empresas: resultados.length,
    publicadas: resultados.reduce((n, r) => n + r.publicadas, 0),
    actualizadas: resultados.reduce((n, r) => n + r.actualizadas, 0),
    redacciones: resultados.reduce((n, r) => n + r.redacciones, 0),
    detalle: resultados,
  });
}
