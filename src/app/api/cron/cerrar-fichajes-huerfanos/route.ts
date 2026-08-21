/**
 * Cron endpoint: cierra automáticamente fichajes que quedaron abiertos
 * (sin hora_salida) en días anteriores y deja la incidencia en su campo
 * propio. La tabla `fichajes` no admite un estado "incidencia".
 *
 * Se ejecuta a las 08:00 UTC (configurado en vercel.json).
 * Solo acepta llamadas con header `Authorization: Bearer ${CRON_SECRET}`.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { hoyEnZona, zonaLocalAUtcISO } from "@/features/empresa/lib/zona-horaria";
import { codigosQueNoComputan, noComputa } from "@/features/rrhh/services/horas/computa-tiempo";

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
      .select("id, hora_entrada, fecha, tipo")
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
      // La salida se fija al FINAL DE SU PROPIO DÍA, no al momento de ejecutarse
      // el cron. Antes se ponía `now()`: quien entró a las 20:00 y no fichó salida
      // quedaba con ~12 h (hasta las 08:00 del día siguiente, cuando corre el
      // cron), y esas horas infladas son las que suma el cálculo del mes para los
      // pagos. Además `horas_totales` no se recalculaba nunca.
      const entradaIso = f.hora_entrada as string | null;
      if (!entradaIso) continue;
      const finDeDia = zonaLocalAUtcISO(f.fecha as string, "23:59", tz);
      const entradaMs = new Date(entradaIso).getTime();
      const salidaMs = Math.max(new Date(finDeDia).getTime(), entradaMs);
      const horas = noComputa(noComputanCodigos, f.tipo as string | null)
        ? 0
        : Math.round(((salidaMs - entradaMs) / 3600000) * 100) / 100;

      const { error: upErr } = await supabase
        .from("fichajes")
        .update({
          estado: "completado",
          hora_salida: new Date(salidaMs).toISOString(),
          horas_totales: horas,
          requiere_revision: true,
          incidencia:
            "Cerrado automáticamente: no se fichó la salida. Horas estimadas hasta el fin del día — revisar.",
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
