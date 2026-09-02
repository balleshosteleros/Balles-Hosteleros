/**
 * Cron: barrido de reservas a medio pagar (PRP-082).
 *
 * Una reserva que exige tarjeta nace PROVISIONAL: aparta la mesa mientras el
 * cliente teclea sus datos, pero no cuenta como reserva del restaurante. Si no
 * llega a pagar, esta limpieza la borra y devuelve la mesa al cupo.
 *
 * Sin ella, cada cliente que abandonase el pago dejaría una mesa bloqueada
 * para siempre.
 *
 * Se ejecuta cada 10 minutos: el plazo para pagar son 15, así que ninguna mesa
 * se queda apartada mucho más de lo necesario.
 *
 * Autorización: Bearer ${CRON_SECRET}.
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // El borrado y la devolución del cupo van juntos dentro de la función, para
  // que no puedan quedar a medias.
  const { data, error } = await supabase.rpc("limpiar_reservas_provisionales");

  if (error) {
    console.error("[cron][reservas-provisionales]", error);
    return NextResponse.json({ error: "Error limpiando" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, borradas: Number(data ?? 0) });
}
