/**
 * Cron endpoint: sincroniza reseñas desde Google Places API para todas las
 * empresas con `google_place_id` configurado.
 *
 * Se ejecuta cada día a las 07:00 (configurado en vercel.json).
 * Las reseñas se upsertean por `external_id`, por lo que el cron es seguro
 * de re-ejecutar y nunca pisa cambios manuales del usuario (estado, respuestas).
 *
 * Las reseñas YA persisten para siempre en la tabla `resenas`; este cron solo
 * añade las nuevas que aparezcan en Google y refresca avatares/textos.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncResenasGoogleForEmpresa } from "@/features/calidad/services/resenas-google-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  // ─── Validar autorización del cron (fail-closed) ──────────────────────────
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/google-resenas-sync] CRON_SECRET no configurado");
    return NextResponse.json(
      { error: "Configuración inválida" },
      { status: 503 },
    );
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // ─── Empresas a sincronizar ───────────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const empresaIdParam = searchParams.get("empresa_id");

  let empresaIds: string[] = [];

  if (empresaIdParam) {
    empresaIds = [empresaIdParam];
  } else {
    const { data: empresas } = await supabase
      .from("empresas")
      .select("id, google_place_id")
      .not("google_place_id", "is", null);
    empresaIds = (empresas ?? []).map((e) => e.id as string);
  }

  if (empresaIds.length === 0) {
    return NextResponse.json({
      ok: true,
      mensaje: "Sin empresas con google_place_id configurado.",
      resultados: [],
    });
  }

  // ─── Ejecutar sync para cada empresa ──────────────────────────────────────
  const resultados = [];
  let hayErrores = false;

  for (const empresaId of empresaIds) {
    try {
      const result = await syncResenasGoogleForEmpresa(supabase, empresaId);
      resultados.push({ empresaId, ...result });
      if (!result.ok) hayErrores = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      hayErrores = true;
      resultados.push({
        empresaId,
        ok: false,
        error: msg,
        insertadas: 0,
        actualizadas: 0,
        total: 0,
      });
      console.error(
        `[cron/google-resenas-sync] Error en empresa ${empresaId}:`,
        err,
      );
    }
  }

  const httpStatus = hayErrores ? 207 : 200;
  return NextResponse.json(
    {
      ok: !hayErrores,
      ejecutadoEn: new Date().toISOString(),
      resultados,
    },
    { status: httpStatus },
  );
}
