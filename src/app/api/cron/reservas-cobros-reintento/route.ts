/**
 * Cron: reintento del cobro de la política de cancelación (PRP-082 §5.5).
 *
 * Cobrar una cancelación va contra una tarjeta guardada, así que puede fallar
 * por falta de fondos. Casi siempre es algo temporal —hoy no hay saldo, mañana
 * sí—, de modo que el cobro no se abandona al primer intento: se reintenta una
 * vez al día hasta el tope configurado por la empresa.
 *
 * Solo toca las reservas cuyo `cancelacion_proximo_intento_at` ya venció. Al
 * cliente NO se le escribe si el intento vuelve a fallar: solo se le avisa de
 * un cobro que ha ocurrido de verdad (§5.7).
 *
 * Se ejecuta cada hora, para respetar la hora que cada empresa haya elegido.
 *
 * Autorización: Bearer ${CRON_SECRET}.
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { ejecutarCobroCancelacion } from "@/features/sala/actions/cobro-politicas-actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Tope por tirada: si hay más, se recogen en la siguiente vuelta del cron. */
const MAX_POR_TIRADA = 50;

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

  // Reservas cuyo próximo intento ya toca. `cobro_perdonado_at` las excluye:
  // si alguien decidió no cobrar, el software no insiste por su cuenta.
  //
  // ⚠️ Solo "fallida", nunca "desconocida". Un cobro del que no sabemos el
  // resultado puede haber salido ya, y reintentarlo cobraría dos veces al
  // cliente. Esos los resuelve el cron de cuadre preguntando a Revolut.
  const { data: pendientes, error } = await supabase
    .from("reservas")
    .select("id, empresa_id")
    .eq("cancelacion_estado", "fallida")
    .not("cancelacion_proximo_intento_at", "is", null)
    .lte("cancelacion_proximo_intento_at", new Date().toISOString())
    .is("cobro_perdonado_at", null)
    .limit(MAX_POR_TIRADA);

  if (error) {
    console.error("[cron][cobros-reintento] consulta:", error);
    return NextResponse.json({ error: "Error consultando" }, { status: 500 });
  }

  let cobrados = 0;
  let fallidos = 0;

  for (const r of pendientes ?? []) {
    // Sin usuario: lo ejecuta el sistema, no una persona.
    const res = await ejecutarCobroCancelacion(
      r.id as string,
      r.empresa_id as string,
      null,
    );
    if (res.ok) cobrados++;
    else fallidos++;
  }

  return NextResponse.json({
    ok: true,
    revisadas: (pendientes ?? []).length,
    cobrados,
    fallidos,
  });
}
