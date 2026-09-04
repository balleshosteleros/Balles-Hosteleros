/**
 * Cron endpoint: cierra automáticamente fichajes que quedaron abiertos
 * (sin hora_salida) en días anteriores, a la hora de FIN DE SU TURNO.
 *
 * Ese cierre se da por bueno: es un fichaje normal, sin revisión ni incidencia.
 * Solo se marca para revisar cuando no hay horario con el que saber la hora y
 * hay que estimarla.
 *
 * Se ejecuta a las 08:00 UTC (configurado en vercel.json).
 * Solo acepta llamadas con header `Authorization: Bearer ${CRON_SECRET}`.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { hoyEnZona, zonaLocalAUtcISO } from "@/features/empresa/lib/zona-horaria";
import { codigosQueNoComputan, noComputa } from "@/features/rrhh/services/horas/computa-tiempo";
import { calcularSalidaPrevista } from "@/features/mi-panel/utils/fichaje-multiempresa";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/cerrar-fichajes-huerfanos] CRON_SECRET no configurado");
    return NextResponse.json({ error: "Configuración inválida" }, { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Se recorre EMPRESA a EMPRESA: "días anteriores" y el cierre dependen de la
  // zona horaria de cada una (PRP-069), no del día UTC del servidor.
  const { data: empresas, error: empErr } = await supabase.from("empresas").select("id");
  if (empErr) {
    console.error("[cron/cerrar-fichajes-huerfanos]", empErr);
    return NextResponse.json({ ok: false, error: empErr.message }, { status: 500 });
  }

  let cerrados = 0;
  const detalle: { id: string; empresaId: string; horas: number }[] = [];

  for (const e of empresas ?? []) {
    const empresaId = e.id as string;
    const tz = await getZonaHorariaEmpresa(supabase, empresaId);
    const hoy = hoyEnZona(tz);

    const { data: abiertos, error } = await supabase
      .from("fichajes")
      .select("id, hora_entrada, fecha, tipo, empleado_id")
      .eq("empresa_id", empresaId)
      .lt("fecha", hoy)
      .is("hora_salida", null)
      .in("estado", ["trabajando", "pausa"]);
    if (error) {
      console.error("[cron/cerrar-fichajes-huerfanos]", empresaId, error.message);
      continue;
    }

    // Tipos que no computan tiempo: una consulta por empresa, no por fichaje.
    const noComputanCodigos = await codigosQueNoComputan(supabase, empresaId);

    for (const f of abiertos ?? []) {
      // La salida se fija a la HORA PREVISTA DE FIN DE SU TURNO, no al momento
      // de ejecutarse el cron (antes `now()`: quien entró a las 20:00 quedaba
      // con ~12 h infladas, y esas horas son las que suma el cálculo del mes
      // para los pagos).
      //
      // Tampoco vale el final del día natural (23:59): en hostelería el turno
      // cruza medianoche, así que a quien entraba a las 19:30 y salía a las
      // 03:00 le recortaba las horas de madrugada — aparecían 4:28 h en vez de
      // sus 7 h. Solo se cae al fin de día cuando NO hay horario con el que
      // predecir la salida.
      const entradaIso = f.hora_entrada as string | null;
      if (!entradaIso) continue;
      const entradaMs = new Date(entradaIso).getTime();

      let previstaMs: number | null = null;
      try {
        const prevista = await calcularSalidaPrevista(
          supabase,
          f.empleado_id as string,
          f.fecha as string,
          entradaIso,
        );
        if (prevista) previstaMs = prevista.getTime();
      } catch (e) {
        console.error("[cron/cerrar-fichajes-huerfanos] salida prevista", f.id, e);
      }

      const finDeDia = zonaLocalAUtcISO(f.fecha as string, "23:59", tz);
      const salidaMs = Math.max(
        previstaMs ?? new Date(finDeDia).getTime(),
        entradaMs,
      );
      const horas = noComputa(noComputanCodigos, f.tipo as string | null)
        ? 0
        : Math.round(((salidaMs - entradaMs) / 3600000) * 100) / 100;

      // Si el sistema SABE la hora de fin del turno, el cierre se da por bueno:
      // es un fichaje normal, sin revisión ni incidencia (el único rastro de que
      // no se fichó salida es `hora_salida_real = null`). Solo se marca para
      // revisar cuando NO hay horario con el que saberla y hay que estimar.
      const sabemosLaHora = previstaMs != null;
      const { error: upErr } = await supabase
        .from("fichajes")
        .update({
          estado: "completado",
          hora_salida: new Date(salidaMs).toISOString(),
          horas_totales: horas,
          requiere_revision: !sabemosLaHora,
          incidencia: sabemosLaHora
            ? null
            : "Cerrado automáticamente: no se fichó la salida y no hay horario para calcularla — revisar.",
        })
        .eq("id", f.id as string);
      if (upErr) {
        console.error("[cron/cerrar-fichajes-huerfanos] update", f.id, upErr.message);
        continue;
      }
      cerrados++;
      detalle.push({ id: f.id as string, empresaId, horas });
    }
  }

  return NextResponse.json({
    ok: true,
    ejecutadoEn: new Date().toISOString(),
    empresas: empresas?.length ?? 0,
    cerrados,
    fichajes: detalle,
  });
}
