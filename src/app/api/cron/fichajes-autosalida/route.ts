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
import { ahoraEnMadrid, getHorarioDia, hhmmAMinutos } from "@/features/rrhh/utils/horario-empleado";

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

  const { fecha: hoy, minutos: ahoraMin } = ahoraEnMadrid();

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

    // Jornadas abiertas de hoy en esta empresa.
    const { data: abiertos } = await supabase
      .from("fichajes")
      .select("id, empleado_id, hora_entrada")
      .eq("empresa_id", empresaId)
      .eq("fecha", hoy)
      .is("hora_salida", null)
      .in("estado", ["trabajando", "pausa"]);

    for (const f of abiertos ?? []) {
      const userId = f.empleado_id as string;

      const { data: empleado } = await supabase
        .from("empleados")
        .select("id")
        .eq("user_id", userId)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (!empleado?.id) continue;

      // Solo horario FIJO tiene hora de salida prevista.
      let entradaMin: number | null = null;
      let salidaMin: number | null = null;
      try {
        const horario = await getHorarioDia(supabase, empresaId, empleado.id as string, hoy);
        if (horario.tipo === "fijo" && horario.tramos.length > 0) {
          const ini = horario.tramos.map((t) => hhmmAMinutos(t.inicio)).filter((m): m is number => m != null);
          const fin = horario.tramos.map((t) => hhmmAMinutos(t.fin)).filter((m): m is number => m != null);
          if (ini.length) entradaMin = Math.min(...ini);
          if (fin.length) salidaMin = Math.max(...fin);
        }
      } catch {
        continue;
      }
      if (entradaMin == null || salidaMin == null) continue;
      // Turno que cruza medianoche: lo gestiona el cron de huérfanos, no este.
      if (salidaMin <= entradaMin) continue;
      // Aún no ha pasado la salida + margen.
      if (ahoraMin < salidaMin + margen) continue;

      // Salida oficial = hora prevista de hoy (relativa a "ahora" para respetar DST).
      const salidaISO = new Date(Date.now() - (ahoraMin - salidaMin) * 60000).toISOString();
      const entradaMs = f.hora_entrada ? new Date(f.hora_entrada as string).getTime() : null;
      const horasTotales =
        entradaMs != null
          ? Math.max(0, Math.round(((new Date(salidaISO).getTime() - entradaMs) / 3600000) * 10000) / 10000)
          : 0;

      const { error: updErr } = await supabase
        .from("fichajes")
        .update({
          hora_salida: salidaISO,
          hora_salida_real: null,
          horas_totales: horasTotales,
          estado: "completado",
          requiere_revision: true,
          revision_motivo: "Cierre automático a la hora de salida prevista (no fichó salida)",
          incidencia: "Cierre automático: jornada cerrada a la hora de salida prevista — pendiente de revisión",
        })
        .eq("id", f.id as string)
        .is("hora_salida", null); // guard anti-carrera: solo si sigue abierta
      if (!updErr) cerrados++;
    }
  }

  return NextResponse.json({
    ok: true,
    ejecutadoEn: new Date().toISOString(),
    empresas: configs?.length ?? 0,
    cerrados,
  });
}
