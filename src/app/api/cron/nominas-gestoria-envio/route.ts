import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { ahoraEnZona } from "@/features/empresa/lib/zona-horaria";
import { enviarSolicitudNominasGestoria } from "@/features/rrhh/services/nominas/nominas-gestoria";

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
    .select(
      "id, nominas_gestoria_activo, nominas_gestoria_email, nominas_gestoria_dia_envio, nominas_gestoria_ultimo_envio",
    );

  let enviados = 0;
  const errores: string[] = [];

  for (const e of empresas ?? []) {
    if (e.nominas_gestoria_activo !== true) continue;
    if (!((e.nominas_gestoria_email as string | null)?.trim())) continue;

    const empresaId = e.id as string;
    // "Ahora" en la zona de la empresa: fecha local y minutos del día. Así el
    // correo sale a las 00:00 HORA DE LA EMPRESA, no del servidor (PRP-069).
    const tz = await getZonaHorariaEmpresa(admin, empresaId);
    const { fecha } = ahoraEnZona(tz); // fecha "YYYY-MM-DD"
    const [anio, mes, dia] = fecha.split("-");
    const periodo = `${anio}-${mes}`;
    const diaMes = Number(dia);

    const diaEnvio = (e.nominas_gestoria_dia_envio as number) ?? 1;
    if (diaMes !== diaEnvio) continue;
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
    errores,
  });
}
