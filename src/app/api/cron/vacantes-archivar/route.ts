import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Archivado automático de vacantes cerradas.
 *
 * Flag: `reclutamiento_config.archivar_vacantes_cerradas_30d` (default true).
 * Pasa a `estado_publicacion='archivada'` las vacantes que llevan ≥30 días en
 * `'cerrada'`, salvo las empresas que lo hayan desactivado explícitamente
 * (flag = false). Como el default es true, las empresas sin fila de config
 * también se archivan.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Configuración inválida" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Empresas que han DESACTIVADO el archivado automático (opt-out explícito).
  const { data: optOut } = await supabase
    .from("reclutamiento_config")
    .select("empresa_id")
    .eq("archivar_vacantes_cerradas_30d", false);
  const optOutIds = (optOut ?? []).map((r) => r.empresa_id as string);

  const treintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from("vacantes")
    .update({ estado_publicacion: "archivada", updated_at: new Date().toISOString() })
    .eq("estado_publicacion", "cerrada")
    .lt("updated_at", treintaDiasAtras)
    .select("id");

  if (optOutIds.length > 0) {
    query = query.not("empresa_id", "in", `(${optOutIds.join(",")})`);
  }

  const { data: archivadas, error } = await query;
  if (error) {
    console.error("[cron vacantes-archivar]", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    ejecutadoEn: new Date().toISOString(),
    vacantesArchivadas: archivadas?.length ?? 0,
  });
}
