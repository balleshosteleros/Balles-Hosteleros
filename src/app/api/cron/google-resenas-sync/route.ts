/**
 * Cron endpoint: sincroniza reseñas desde Google Places API para todas las
 * empresas con `google_place_id` configurado.
 *
 * Se ejecuta cada día a las 07:00 (configurado en vercel.json).
 *
 * ⚠️ LIMITACIÓN CONOCIDA — riesgo de perder reseñas en hora punta:
 * Google Places solo devuelve las 5 reseñas MÁS RECIENTES, así que la
 * frecuencia de esta pasada marca cuántas caben entre dos ejecuciones sin
 * perderse. A diario el margen es de 5 reseñas AL DÍA: una mesa grande que
 * reseña a la vez al salir puede agotarlo de golpe, y la que se cae puede ser
 * justo la negativa.
 *
 * La frecuencia horaria ("0 * * * *") subiría el margen a ~120/día y está
 * probada, pero el plan Vercel Hobby SOLO admite crons diarios (el deploy
 * falla con "Hobby accounts are limited to daily cron jobs"). Al pasar a Pro,
 * cambiar el schedule en vercel.json es lo único necesario.
 *
 * Las reseñas se upsertean por `external_id`, por lo que el cron es seguro
 * de re-ejecutar y nunca pisa cambios manuales del usuario (estado, respuestas).
 * Si no hay reseñas nuevas, la pasada no consume IA: los borradores solo se
 * generan para las que entran sin borrador previo.
 *
 * Las reseñas YA persisten para siempre en la tabla `resenas`; este cron solo
 * añade las nuevas que aparezcan en Google y refresca avatares/textos.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncResenasGoogleForEmpresa } from "@/features/calidad/services/resenas-google-sync";
import { generarBorradoresPendientesForEmpresa } from "@/features/calidad/services/generar-borradores";

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

      // Si entraron reseñas nuevas, la IA redacta ya su borrador de respuesta
      // para que estén listas al abrir la pantalla. Un fallo aquí no invalida
      // la sincronización, que es lo importante.
      let borradores = { generados: 0, saltados: 0 };
      if (result.ok && result.insertadas > 0) {
        try {
          const r = await generarBorradoresPendientesForEmpresa(
            supabase,
            empresaId,
          );
          borradores = { generados: r.generados, saltados: r.saltados };
        } catch (e) {
          console.warn(
            `[cron/google-resenas-sync] borradores IA fallaron en ${empresaId}:`,
            e,
          );
        }
      }

      resultados.push({ empresaId, ...result, borradores });
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
