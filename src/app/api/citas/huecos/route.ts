/**
 * GET /api/citas/huecos?calendario=<id> — horas libres de un calendario.
 *
 * Público: lo llama el selector de la página del embudo, donde el visitante no
 * tiene sesión. Solo devuelve horas libres; nunca quién ocupa las demás.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { zonaHorariaDeConfig } from "@/features/empresa/lib/empresa-server";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";
import { huecosLibres } from "@/features/producto/citas/services/huecos";
import { rateLimit } from "@/shared/lib/rate-limit-memory";
import { extraerIp } from "@/features/marketing/pagina-web/services/ip-hash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const calendarioId = req.nextUrl.searchParams.get("calendario");
  if (!calendarioId) {
    return NextResponse.json({ ok: false, error: "Falta el calendario" }, { status: 400 });
  }

  const ip = extraerIp(req.headers) ?? "desconocida";
  if (!rateLimit(`huecos:${ip}`, 60, 60_000).ok) {
    return NextResponse.json({ ok: false, error: "Demasiadas consultas" }, { status: 429 });
  }

  try {
    const supabase = createAdminClient();

    const { data: cal } = await supabase
      .from("citas_calendarios")
      .select("empresa_id, duracion_min")
      .eq("id", calendarioId)
      .maybeSingle();
    if (!cal) {
      return NextResponse.json({ ok: false, error: "Calendario no encontrado" }, { status: 404 });
    }

    const { data: emp } = await supabase
      .from("empresas")
      .select("datos_generales")
      .eq("id", (cal as { empresa_id: string }).empresa_id)
      .maybeSingle();
    const zonaHoraria = zonaHorariaDeConfig((emp as { datos_generales?: unknown } | null)?.datos_generales);

    const res = await huecosLibres(supabase, calendarioId, zonaHoraria, hoyEnZona(zonaHoraria));
    if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });

    return NextResponse.json({
      ok: true,
      zonaHoraria,
      duracionMin: res.calendario.duracion_min,
      dias: res.dias,
    });
  } catch (err) {
    console.error("[api/citas/huecos]", err);
    return NextResponse.json({ ok: false, error: "Error inesperado" }, { status: 500 });
  }
}
