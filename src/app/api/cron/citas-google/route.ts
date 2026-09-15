/**
 * Cron: mira si alguna cita se ha caído DESDE EL CALENDARIO del cliente.
 *
 * Quien reserva recibe la cita como invitación. Si en vez de usar el enlace del
 * correo la rechaza desde su Google Calendar —o si alguien borra el evento— esa
 * decisión se queda en Google y el software no se entera: la cita seguiría
 * CONFIRMADA, el hueco bloqueado y alguien esperando a una reunión a la que no
 * va a ir nadie.
 *
 * Aquí se repasan las citas CONFIRMADAS que están por delante y, si Google dice
 * que la han rechazado o que el evento ya no existe, se anulan por el mismo
 * camino que todo lo demás: la cita pasa a CANCELADA, el hueco se libera y al
 * equipo le salta el aviso.
 *
 * Solo mira las citas que TIENEN evento en Google. Un calendario sin cuenta
 * designada no tiene nada que sincronizar y se salta sin ruido.
 *
 * Ante la duda NO se toca nada: si no se puede preguntar a Google (sin permiso,
 * Google caído), la cita se queda como está. Es peor anular una cita buena que
 * tardar en enterarse de una anulada.
 *
 * Cada 15 minutos. No depende de la hora local de ninguna empresa: no hay
 * ventana que calcular, solo se pregunta por citas futuras.
 *
 * Solo acepta llamadas con header `Authorization: Bearer ${CRON_SECRET}`.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { estadoDeLaCitaEnGoogle } from "@/features/producto/citas/services/google-calendar";
import { cancelarCita } from "@/features/producto/citas/services/cancelar-cita";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Tope por pasada: el cron no puede eternizarse preguntando a Google. */
const MAXIMO_POR_PASADA = 40;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/citas-google] CRON_SECRET no configurado");
    return NextResponse.json({ error: "Configuración inválida" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase
    .from("citas")
    .select("id")
    .eq("estado", "CONFIRMADA")
    .not("google_event_id", "is", null)
    .gte("inicio", new Date().toISOString())
    .order("inicio")
    .limit(MAXIMO_POR_PASADA);

  if (error) {
    console.error("[cron/citas-google]", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let anuladas = 0;
  for (const fila of (data ?? []) as { id: string }[]) {
    const estado = await estadoDeLaCitaEnGoogle(fila.id);
    if (!estado) continue; // no se ha podido saber: no se toca
    if (!estado.rechazada && !estado.borrado) continue;

    const res = await cancelarCita(fila.id, "CLIENTE_CALENDARIO");
    if (res.ok && !res.yaEstaba) anuladas += 1;
  }

  return NextResponse.json({ ok: true, revisadas: (data ?? []).length, anuladas });
}
