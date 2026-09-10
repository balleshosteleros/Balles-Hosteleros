/**
 * Cron: pone al día el índice de correo de todos los buzones auditados.
 *
 * Cada hora recorre los buzones conectados de todas las empresas y les pide a
 * Gmail lo de los últimos días. Si a alguno le falta histórico por volcar,
 * aprovecha para retroceder un tramo más: así los 12 meses iniciales se
 * completan solos en unas cuantas pasadas, sin que ninguna ejecución se pase de
 * tiempo ni se quede a medias en silencio.
 *
 * NO GASTA IA. Aquí no se llama a ningún modelo: se copia el índice del buzón y
 * se guarda. El tope de gasto mensual de IA no se toca en ningún punto.
 *
 * Se reparte el tiempo entre los buzones que quedan, y el que no llegue a
 * entrar en esta pasada entra en la siguiente: son los mismos buzones cada hora
 * y ninguno se queda descolgado.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sincronizarBuzon } from "@/features/direccion/correo-auditoria/services/gmail-ingesta";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Margen amplio: el volcado inicial es lo que más tarda. */
export const maxDuration = 300;

/** Se deja un colchón para poder responder antes de que corten la ejecución. */
const PRESUPUESTO_TOTAL_MS = 250_000;
/** Ningún buzón acapara la pasada: como mucho este trozo del tiempo. */
const PRESUPUESTO_MAX_BUZON_MS = 60_000;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/correo-auditoria-sync] CRON_SECRET no configurado");
    return NextResponse.json({ error: "Configuración inválida" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const arranque = Date.now();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { searchParams } = new URL(request.url);
  const soloBuzon = searchParams.get("buzon_id");

  let consulta = supabase
    .from("correo_buzones")
    .select("id, email, backfill_hasta")
    .eq("estado", "Activo")
    // Los caducados también entran: si alguien ha vuelto a dar permiso, la
    // pasada los recupera sola sin esperar a que nadie toque nada.
    .in("conexion", ["conectado", "caducado"])
    // Primero los que aún tienen histórico pendiente, para que el volcado
    // inicial avance antes que los que ya están al día.
    .order("backfill_hasta", { ascending: false, nullsFirst: true });

  if (soloBuzon) consulta = consulta.eq("id", soloBuzon);

  const { data: buzones, error } = await consulta;
  if (error) {
    console.error("[cron/correo-auditoria-sync] listar buzones:", error.message);
    return NextResponse.json({ error: "No se han podido leer los buzones" }, { status: 500 });
  }
  if (!buzones?.length) {
    return NextResponse.json({ ok: true, buzones: 0, guardados: 0 });
  }

  let guardados = 0;
  let procesados = 0;
  let pendientes = 0;

  for (const buzon of buzones) {
    const restante = PRESUPUESTO_TOTAL_MS - (Date.now() - arranque);
    if (restante < 5_000) {
      // Se acabó el tiempo: los que faltan entran en la pasada siguiente.
      pendientes += buzones.length - procesados;
      break;
    }

    const restantesPorHacer = buzones.length - procesados;
    const presupuesto = Math.min(
      PRESUPUESTO_MAX_BUZON_MS,
      Math.floor(restante / restantesPorHacer),
    );

    const res = await sincronizarBuzon(buzon.id as string, presupuesto);
    guardados += res.guardados;
    procesados += 1;

    if (!res.ok && res.error) {
      console.warn(`[cron/correo-auditoria-sync] ${buzon.email}: ${res.error}`);
    }
  }

  return NextResponse.json({
    ok: true,
    buzones: procesados,
    guardados,
    pendientes,
    ms: Date.now() - arranque,
  });
}
