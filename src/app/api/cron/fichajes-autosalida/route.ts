/**
 * Cron: AUTO-FICHAR SALIDA (PRP-060).
 *
 * Para empresas con `auto_salida_activa`, cierra las jornadas de horario FIJO
 * que siguen abiertas pasada su hora de salida prevista + margen. Pone la salida
 * OFICIAL en la hora prevista, deja `hora_salida_real = null` (no fichó) y marca
 * `requiere_revision`. No toca flexibles, ni jornadas ya cerradas, ni la
 * paralización (esas ya tienen hora_salida). Los huérfanos de días anteriores
 * los sigue cerrando su propio cron.
 *
 * Autorización: header `Authorization: Bearer ${CRON_SECRET}`.
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { ahoraEnMadrid } from "@/features/rrhh/utils/horario-empleado";
import { calcularSalidaPrevista, cerrarConReparto } from "@/features/mi-panel/utils/fichaje-multiempresa";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Configuración inválida" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { fecha: hoy } = ahoraEnMadrid();

  const { data: configs, error: cfgErr } = await supabase
    .from("empresa_fichajes_config")
    .select("empresa_id, auto_salida_activa, auto_salida_margen_min")
    .eq("auto_salida_activa", true);
  if (cfgErr) {
    return NextResponse.json({ ok: false, error: cfgErr.message }, { status: 500 });
  }

  let cerrados = 0;

  for (const cfg of configs ?? []) {
    const empresaId = cfg.empresa_id as string;
    const margen = (cfg.auto_salida_margen_min as number | null) ?? 15;

    // Jornadas abiertas de hoy cuyo fichaje pertenece a esta empresa (la de la
    // entrada). El reparto y la salida prevista se calculan con el horario
    // UNIFICADO del empleado, para no cerrar antes una jornada partida.
    const { data: abiertos } = await supabase
      .from("fichajes")
      .select("id, empleado_id, empleado_nombre, hora_entrada, local_id, centro, tipo, modo_teletrabajo, empresa_id")
      .eq("empresa_id", empresaId)
      .eq("fecha", hoy)
      .is("hora_salida", null)
      .in("estado", ["trabajando", "pausa"]);

    for (const f of abiertos ?? []) {
      const userId = f.empleado_id as string;
      if (!f.hora_entrada) continue;
      // Salida prevista según el tipo de turno (fijo o flexible diario) entre
      // TODAS sus empresas, para no cortar una jornada partida.
      let salidaPrevista: Date | null = null;
      try {
        salidaPrevista = await calcularSalidaPrevista(supabase, userId, hoy, f.hora_entrada as string);
      } catch {
        continue;
      }
      if (salidaPrevista == null) continue;
      // Aún no ha pasado la salida prevista + margen.
      if (Date.now() < salidaPrevista.getTime() + margen * 60000) continue;
      try {
        await cerrarConReparto(
          supabase,
          {
            fichajeId: f.id as string,
            userId,
            nombre: (f.empleado_nombre as string) ?? "",
            empresaId: f.empresa_id as string,
            localId: (f.local_id as string | null) ?? null,
            centro: (f.centro as string | null) ?? "",
            tipo: (f.tipo as string | null) ?? null,
            modoTeletrabajo: Boolean(f.modo_teletrabajo),
            fecha: hoy,
            horaEntrada: f.hora_entrada as string,
          },
          salidaPrevista,
          { autoCierre: true },
        );
        cerrados++;
      } catch {
        // Si uno falla, sigue con el resto.
      }
    }
  }

  return NextResponse.json({
    ok: true,
    ejecutadoEn: new Date().toISOString(),
    empresas: configs?.length ?? 0,
    cerrados,
  });
}
