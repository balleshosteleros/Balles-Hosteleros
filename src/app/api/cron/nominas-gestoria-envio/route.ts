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
 * Corre cada hora. Para cada empresa con el envío ACTIVO y correo de gestoría,
 * comprueba si AHORA (en la zona horaria de la empresa) es el día del mes
 * configurado (`nominas_gestoria_dia_envio`, por defecto el 1) y estamos en la
 * franja de las 00:00 (medianoche local). Si lo es y no se envió ya ese mes
 * (`nominas_gestoria_ultimo_envio`), crea el token del periodo y manda el correo.
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
    const { fecha, minutos } = ahoraEnZona(tz); // fecha "YYYY-MM-DD"
    const [anio, mes, dia] = fecha.split("-");
    const periodo = `${anio}-${mes}`;
    const diaMes = Number(dia);

    const diaEnvio = (e.nominas_gestoria_dia_envio as number) ?? 1;
    if (diaMes !== diaEnvio) continue;
    // Solo en la franja de medianoche (00:00–00:59) de la empresa: el cron corre
    // cada hora, esto lo restringe a una única franja del día.
    if (minutos >= 60) continue;
    // Ya enviado este mes (idempotencia frente al cron horario).
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
