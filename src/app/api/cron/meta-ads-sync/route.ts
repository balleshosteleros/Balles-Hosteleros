/**
 * PRP-087 · Refresco horario de Meta Ads.
 *
 * Trae de cada empresa conectada los tres niveles de su cuenta publicitaria y
 * los resultados por día, y los vuelca al espejo. Así la pantalla de Marketing
 * abre al instante en vez de esperar a Meta, y no se castiga el cupo de la API
 * con una llamada por cada persona que entra.
 *
 * Va por empresas de una en una y a prueba de fallos: si la conexión de HABANA
 * ha caducado, BACANAL se sincroniza igual. Un error en una no puede dejar a
 * las demás sin datos.
 *
 * Autorización: Bearer ${CRON_SECRET}, como el resto de crons.
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getMetaCredenciales } from "@/features/marketing/meta-ads/services/meta-credenciales";
import { sincronizarEstructura } from "@/features/marketing/meta-ads/services/meta-lectura";
import { sincronizarInsights } from "@/features/marketing/meta-ads/services/meta-insights";
import { avisarCaducidadesMeta } from "@/features/marketing/meta-ads/services/meta-aviso-caducidad";

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

  const { data: conectadas, error } = await db
    .from("empresa_meta_config")
    .select("empresa_id")
    .eq("activo", true);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const resultados: Array<Record<string, unknown>> = [];

  for (const fila of conectadas ?? []) {
    const empresaId = (fila as { empresa_id: string }).empresa_id;
    try {
      const cred = await getMetaCredenciales(db, empresaId);
      if (!cred) {
        resultados.push({ empresaId, saltada: "sin credenciales utilizables" });
        continue;
      }

      const estructura = await sincronizarEstructura(db, empresaId, cred);

      // Los tres niveles de resultados. El de campaña es el que alimenta el
      // tope de gasto mensual, así que ese no puede faltar.
      const [campana, conjunto, anuncio] = await Promise.all([
        sincronizarInsights(db, empresaId, cred, "campana"),
        sincronizarInsights(db, empresaId, cred, "conjunto"),
        sincronizarInsights(db, empresaId, cred, "anuncio"),
      ]);

      resultados.push({
        empresaId,
        ...estructura,
        insights: { campana, conjunto, anuncio },
      });
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "Error desconocido";
      console.error(`[meta-ads-sync] empresa ${empresaId}:`, mensaje);
      resultados.push({ empresaId, error: mensaje });
    }
  }

  // Avisar de las conexiones a punto de caducar. Va al final y aparte del
  // bucle: si Meta está caído y falla la sincronización de todas las empresas,
  // el aviso de caducidad tiene que salir igualmente — es justo cuando más
  // falta hace.
  let avisosCaducidad = 0;
  try {
    avisosCaducidad = await avisarCaducidadesMeta(db);
  } catch (err) {
    console.error("[meta-ads-sync] avisos de caducidad:", err);
  }

  return NextResponse.json({
    ok: true,
    empresas: resultados.length,
    avisosCaducidad,
    resultados,
  });
}
