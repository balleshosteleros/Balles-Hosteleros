/**
 * Cron: REAVISOS de fichar (PRP-060).
 *
 * Cada minuto, para las empresas con `reaviso_activo`, busca empleados con
 * horario FIJO hoy que están dentro de su ventana de
 * cortesía de ENTRADA (entrada − margen_antes … entrada + margen_despues) y que
 * aún NO han fichado, y les envía un push de recordatorio cada `reaviso_intervalo`
 * minutos. Idempotente vía `fichaje_reavisos_log` (UNIQUE user_id, fecha, slot).
 *
 * Autorización: header `Authorization: Bearer ${CRON_SECRET}`.
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getHorarioDia, hhmmAMinutos } from "@/features/rrhh/utils/horario-empleado";
import { ahoraEnZona } from "@/features/empresa/lib/zona-horaria";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
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

  // El "ahora" se resuelve POR EMPRESA dentro del bucle, en su zona horaria
  // (PRP-069): empresas en husos distintos avisan a su propia hora local.

  // Empresas con reaviso activo (o aviso de cambio de empresa).
  const { data: configs, error: cfgErr } = await supabase
    .from("empresa_fichajes_config")
    .select(
      "empresa_id, popup_margen_antes_min, popup_margen_despues_min, reaviso_activo, reaviso_intervalo_min, aviso_cambio_empresa",
    )
    .or("reaviso_activo.eq.true,aviso_cambio_empresa.eq.true");
  if (cfgErr) {
    return NextResponse.json({ ok: false, error: cfgErr.message }, { status: 500 });
  }

  let enviados = 0;
  let candidatos = 0;

  for (const cfg of configs ?? []) {
    const empresaId = cfg.empresa_id as string;
    // "Ahora" en la zona horaria de ESTA empresa.
    const tz = await getZonaHorariaEmpresa(supabase, empresaId);
    const { fecha: hoy, minutos: ahoraMin } = ahoraEnZona(tz);
    const margenAntes = (cfg.popup_margen_antes_min as number | null) ?? 15;
    const margenDespues = (cfg.popup_margen_despues_min as number | null) ?? 15;
    const intervalo = Math.max(1, (cfg.reaviso_intervalo_min as number | null) ?? 5);
    const reavisoActivo = Boolean(cfg.reaviso_activo);
    const avisoCambioEmpresa = Boolean(cfg.aviso_cambio_empresa);
    let empresaNombre = "esta empresa";
    if (avisoCambioEmpresa) {
      const { data: er } = await supabase.from("empresas").select("nombre").eq("id", empresaId).maybeSingle();
      empresaNombre = (er?.nombre as string | undefined) ?? "esta empresa";
    }

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

      // ¿Tiene una jornada ABIERTA hoy en CUALQUIER empresa? Entonces ya está
      // trabajando (jornada continua multi-empresa): NO se le dice "ficha entrada".
      const { data: abierto } = await supabase
        .from("fichajes")
        .select("id, empresa_id")
        .eq("empleado_id", userId)
        .eq("fecha", hoy)
        .is("hora_salida", null)
        .in("estado", ["trabajando", "pausa"])
        .limit(1)
        .maybeSingle();
      if (abierto) {
        // Si su jornada continúa en ESTA empresa (el fichaje abierto es de otra) y
        // la empresa lo activó, se le avisa de que su jornada continúa aquí (una vez).
        if (avisoCambioEmpresa && abierto.empresa_id !== empresaId) {
          const { error: logErr } = await supabase
            .from("fichaje_reavisos_log")
            .insert({ empresa_id: empresaId, user_id: userId, fecha: hoy, slot_min: 9999 });
          if (!logErr) {
            const res = await sendPushWithClient(supabase, {
              userId,
              empresaId,
              eventType: "fichaje_recordatorio",
              payload: {
                title: "Tu jornada continúa",
                body: `Sigues fichado: tu jornada continúa ahora en ${empresaNombre}. No tienes que volver a fichar.`,
                url: "/m",
                tag: "fichaje-cambio-empresa",
                renotify: true,
              },
            });
            enviados += res.delivered;
          }
        }
        continue;
      }

      // ¿Ya fichó (y cerró) hoy en esta empresa? Si sí, no se reavisa.
      const { data: fich } = await supabase
        .from("fichajes")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("empleado_id", userId)
        .eq("fecha", hoy)
        .not("hora_entrada", "is", null)
        .limit(1);
      if (fich && fich.length > 0) continue;

      // Reaviso normal de "ficha entrada" (solo si la empresa lo tiene activo).
      if (reavisoActivo) {
        // Idempotencia: reservar el slot antes de enviar. Si ya existe, saltar.
        const { error: logErr } = await supabase
          .from("fichaje_reavisos_log")
          .insert({ empresa_id: empresaId, user_id: userId, fecha: hoy, slot_min: offset });
        if (!logErr) {
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
