import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { ahoraEnZona } from "@/features/empresa/lib/zona-horaria";
import {
  enviarSolicitudNominasGestoria,
  recordarSolicitudNominasGestoria,
  mesSolicitado,
} from "@/features/rrhh/services/nominas/nominas-gestoria";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Envío automático a la gestoría del enlace para subir las nóminas del mes.
 *
 * Corre UNA VEZ AL DÍA, a las 02:00 UTC. Era cada hora, pero el plan de Vercel
 * es Hobby y solo admite crons diarios: el deploy se rechazaba entero
 * ("Hobby accounts are limited to daily cron jobs") y dejaba producción sin
 * publicar. Al pasar a Pro basta con devolver el schedule a "0 * * * *".
 *
 * La lógica no necesita la pasada horaria: mira si HOY es el día configurado y
 * `ultimo_envio` impide repetir, así que una pasada diaria envía igual. Las
 * 02:00 UTC son un punto donde el día ya entró en Europa y aún no acabó en
 * América; una empresa en un huso muy adelantado o atrasado podría recibir el
 * aviso en el día vecino al configurado.
 *
 * Para cada empresa con el envío ACTIVO y correo de gestoría,
 * comprueba si HOY (en la zona horaria de la empresa) es el día del mes
 * configurado (`nominas_gestoria_dia_envio`, por defecto el 1). Si lo es y no se
 * envió ya ese mes (`nominas_gestoria_ultimo_envio`, que garantiza un único envío
 * mensual), crea el token del periodo y manda el correo.
 * El enlace lleva a `/gestoria/nominas/<token>`, donde la gestoría sube las
 * nóminas y la IA las vuelca a `rrhh_pagos`.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Configuración inválida" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: empresas } = await admin
    .from("empresas")
    // En una sola cadena literal: si se parte con `+`, PostgREST pierde el tipado
    // de las columnas y todo el bucle queda sin tipar.
    .select(
      "id, nominas_gestoria_activo, nominas_gestoria_email, nominas_gestoria_dia_envio, nominas_gestoria_ultimo_envio, nominas_gestoria_recordatorio_activo, nominas_gestoria_recordatorio_dias, nominas_gestoria_recordatorio_hora, nominas_gestoria_ultimo_recordatorio",
    );

  let enviados = 0;
  let recordatorios = 0;
  const errores: string[] = [];

  for (const e of empresas ?? []) {
    if (e.nominas_gestoria_activo !== true) continue;
    // El correo NO se comprueba aquí: vive en Ajustes → Configuración
    // (`datos_generales.correoGestoria`), y este filtro miraba un campo distinto
    // que está vacío, así que descartaba a TODAS las empresas y no salía nada.
    // `enviarSolicitudNominasGestoria` resuelve el correo de la fuente correcta y
    // devuelve el error si de verdad falta.

    const empresaId = e.id as string;
    // "Ahora" en la zona de la empresa: fecha local y minutos del día. Así el
    // correo sale a las 00:00 HORA DE LA EMPRESA, no del servidor (PRP-069).
    const tz = await getZonaHorariaEmpresa(admin, empresaId);
    const { fecha, minutos } = ahoraEnZona(tz); // fecha "YYYY-MM-DD"
    const [anio, mes, dia] = fecha.split("-");
    const diaMes = Number(dia);

    const diaEnvio = (e.nominas_gestoria_dia_envio as number) ?? 1;
    // Meses cortos: si se configura 29/30/31 y el mes no llega, se envía el
    // último día (en febrero, el 28). Si no, esos meses se saltarían.
    const ultimoDiaMes = new Date(Date.UTC(Number(anio), Number(mes), 0)).getUTCDate();
    const diaEfectivo = Math.min(diaEnvio, ultimoDiaMes);

    // ── RECORDATORIO ────────────────────────────────────────────────────────
    // N días DESPUÉS del aviso (no una fecha fija: así sigue al aviso aunque se
    // cambie su día). Se manda el MISMO enlace y solo si NO han subido nada: el
    // propio enlace queda cerrado al recibir las nóminas, y eso es lo que se
    // comprueba. Se calcula sobre la fecha REAL del aviso, así que cruza bien el
    // cambio de mes (28 de agosto + 4 = 1 de septiembre).
    if (e.nominas_gestoria_recordatorio_activo === true) {
      const dias = (e.nominas_gestoria_recordatorio_dias as number) ?? 4;
      const horaMin = ((e.nominas_gestoria_recordatorio_hora as number) ?? 12) * 60;
      const fechaAviso = new Date(Date.UTC(Number(anio), Number(mes) - 1, diaEfectivo));
      // Si hoy es anterior al día del aviso, el aviso vigente fue el del mes pasado.
      if (diaMes < diaEfectivo) fechaAviso.setUTCMonth(fechaAviso.getUTCMonth() - 1);
      const fechaRecordatorio = new Date(fechaAviso.getTime() + dias * 86400000);
      const hoyUtc = new Date(Date.UTC(Number(anio), Number(mes) - 1, diaMes));

      if (hoyUtc.getTime() === fechaRecordatorio.getTime() && minutos >= horaMin) {
        const periodoAviso = mesSolicitado(
          String(fechaAviso.getUTCFullYear()),
          String(fechaAviso.getUTCMonth() + 1).padStart(2, "0"),
          diaEnvio,
        );
        if ((e.nominas_gestoria_ultimo_recordatorio as string | null) !== periodoAviso) {
          const rec = await recordarSolicitudNominasGestoria(admin, empresaId, periodoAviso);
          if (rec.ok && !rec.omitido) recordatorios++;
          // Se marca siempre (aunque se omita por "ya subido"): no hay que
          // volver a comprobarlo hoy.
          await admin
            .from("empresas")
            .update({ nominas_gestoria_ultimo_recordatorio: periodoAviso })
            .eq("id", empresaId);
        }
      }
    }

    if (diaMes !== diaEfectivo) continue;

    // QUÉ MES SE PIDE: siempre las ÚLTIMAS nóminas, sin ambigüedad.
    //   • Día ALTO (16 en adelante): el mes ya está cerrándose → se piden las de
    //     ESE mes. Ej.: aviso el 28 de agosto → nóminas de agosto.
    //   • Día BAJO (1–15): el mes en curso acaba de empezar → se piden las del
    //     mes ANTERIOR, que son las últimas cerradas. Ej.: aviso el 3 de
    //     septiembre → nóminas de agosto.
    // Antes se pedía SIEMPRE el mes en curso, así que con un día bajo se reclamaba
    // un mes que aún no ha terminado (el 3 de septiembre pedía septiembre).
    const periodo = mesSolicitado(anio, mes, diaEnvio);
    // NO se restringe a la franja de medianoche local. Los crons de Vercel solo
    // disparan en horas EN PUNTO UTC, que en un huso como Europe/Madrid (+1/+2)
    // caen a las 01:00/02:00 locales: la condición "00:00–00:59 local" no se
    // cumplía jamás y el correo del día 1 no llegaba nunca a la gestoría.
    // Basta con que sea el día configurado; de no repetir envío ya se encarga
    // `ultimo_envio`, que es el control de idempotencia real.
    if ((e.nominas_gestoria_ultimo_envio as string | null) === periodo) continue;

    const res = await enviarSolicitudNominasGestoria(admin, empresaId, periodo);
    if (!res.ok) {
      errores.push(`${empresaId}: ${res.error ?? "error"}`);
      continue;
    }

    await admin
      .from("empresas")
      .update({ nominas_gestoria_ultimo_envio: periodo })
      .eq("id", empresaId);
    enviados++;
  }

  return NextResponse.json({
    ok: true,
    ejecutadoEn: new Date().toISOString(),
    enviados,
    recordatorios,
    errores,
  });
}
