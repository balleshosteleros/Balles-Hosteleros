/**
 * Cron: REAVISOS de fichar (PRP-060).
 *
 * Cada minuto, para las empresas con `reaviso_activo` y `popup_modo = 'ventana'`,
 * busca empleados con horario FIJO hoy que están dentro de su ventana de
 * cortesía de ENTRADA (entrada − margen_antes … entrada + margen_despues) y que
 * aún NO han fichado, y les envía un push de recordatorio cada `reaviso_intervalo`
 * minutos. Idempotente vía `fichaje_reavisos_log` (UNIQUE user_id, fecha, slot).
 *
 * Autorización: header `Authorization: Bearer ${CRON_SECRET}`.
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { ahoraEnMadrid, getHorarioDia, hhmmAMinutos } from "@/features/rrhh/utils/horario-empleado";
import { sendPushWithClient } from "@/features/mi-panel/mobile/lib/push-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Distancia circular (min) de `now` a `target`: <0 antes, >0 después. */
function offsetCircular(now: number, target: number): number {
  let d = (((now - target) % 1440) + 1440) % 1440;
  if (d > 720) d -= 1440;
  return d;
}

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

  // Empresas con reaviso activo en modo ventana.
  const { data: configs, error: cfgErr } = await supabase
    .from("empresa_fichajes_config")
    .select(
      "empresa_id, popup_modo, popup_margen_antes_min, popup_margen_despues_min, reaviso_activo, reaviso_intervalo_min",
    )
    .eq("reaviso_activo", true)
    .eq("popup_modo", "ventana");
  if (cfgErr) {
    return NextResponse.json({ ok: false, error: cfgErr.message }, { status: 500 });
  }

  let enviados = 0;
  let candidatos = 0;

  for (const cfg of configs ?? []) {
    const empresaId = cfg.empresa_id as string;
    const margenAntes = (cfg.popup_margen_antes_min as number | null) ?? 15;
    const margenDespues = (cfg.popup_margen_despues_min as number | null) ?? 15;
    const intervalo = Math.max(1, (cfg.reaviso_intervalo_min as number | null) ?? 5);

    // Empleados activos de la empresa.
    const { data: empleados } = await supabase
      .from("empleados")
      .select("id, user_id, estado")
      .eq("empresa_id", empresaId)
      .not("user_id", "is", null);

    for (const emp of empleados ?? []) {
      if (emp.estado === "Inactivo") continue;
      const userId = emp.user_id as string;
      const empleadoId = emp.id as string;

      // Horario de hoy: solo FIJO tiene "hora de entrada" para vigilar.
      let entradaMin: number | null = null;
      try {
        const horario = await getHorarioDia(supabase, empresaId, empleadoId, hoy);
        if (horario.tipo === "fijo" && horario.tramos.length > 0) {
          const inicios = horario.tramos
            .map((t) => hhmmAMinutos(t.inicio))
            .filter((m): m is number => m != null);
          if (inicios.length) entradaMin = Math.min(...inicios);
        }
      } catch {
        entradaMin = null;
      }
      if (entradaMin == null) continue;

      // ¿Dentro de la ventana de cortesía y en un "slot" de reaviso?
      const offset = offsetCircular(ahoraMin, entradaMin);
      if (offset < -margenAntes || offset > margenDespues) continue;
      if (((offset % intervalo) + intervalo) % intervalo !== 0) continue;
      candidatos++;

      // ¿Ya fichó entrada hoy en esta empresa? Si sí, no se reavisa.
      const { data: fich } = await supabase
        .from("fichajes")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("empleado_id", userId)
        .eq("fecha", hoy)
        .not("hora_entrada", "is", null)
        .limit(1);
      if (fich && fich.length > 0) continue;

      // Idempotencia: reservar el slot antes de enviar. Si ya existe, saltar.
      const { error: logErr } = await supabase
        .from("fichaje_reavisos_log")
        .insert({ empresa_id: empresaId, user_id: userId, fecha: hoy, slot_min: offset });
      if (logErr) continue; // conflicto UNIQUE → ya enviado este slot

      const antes = offset < 0;
      const res = await sendPushWithClient(supabase, {
        userId,
        empresaId,
        eventType: "fichaje_recordatorio",
        payload: {
          title: "Recuerda fichar",
          body: antes
            ? `Tu entrada es en ${Math.abs(offset)} min. No olvides fichar.`
            : offset === 0
              ? "Es tu hora de entrada. Ficha tu entrada."
              : `Llevas ${offset} min de tu hora de entrada sin fichar.`,
          url: "/m",
          tag: "fichaje-recordatorio",
          renotify: true,
        },
      });
      enviados += res.delivered;
    }
  }

  return NextResponse.json({
    ok: true,
    ejecutadoEn: new Date().toISOString(),
    empresas: configs?.length ?? 0,
    candidatos,
    pushEnviados: enviados,
  });
}
