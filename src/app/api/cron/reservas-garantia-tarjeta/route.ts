/**
 * Cron: solicitud diferida de la tarjeta de garantía (PRP-082 §5.4).
 *
 * Una retención caduca —5 días con Visa en un restaurante—, así que en una
 * reserva a un mes vista no sirve pedir la tarjeta al reservar: el día de la
 * reserva ya no habría nada retenido. Se pide cuando falta poco.
 *
 * Dos trabajos, en este orden:
 *
 *   1. PEDIR: reservas cuya fecha entra dentro de la ventana configurada
 *      (4 días por defecto) y siguen sin tarjeta. Se les manda el correo con
 *      su enlace y se les pone un plazo (24 h por defecto).
 *   2. CADUCAR: reservas a las que se les pasó el plazo sin poner tarjeta. Se
 *      cancelan y se avisa al cliente — salvo que la empresa haya apagado la
 *      cancelación automática, y entonces solo queda el aviso en Sala.
 *
 * Solo afecta a la GARANTÍA: la política de cancelación guarda la tarjeta sin
 * retener nada, y eso no caduca.
 *
 * Autorización: Bearer ${CRON_SECRET}.
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { enviarReservaEmail } from "@/lib/email/reservas/mailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Tope por tirada: lo que no entre se recoge en la siguiente vuelta. */
const MAX_POR_TIRADA = 100;

interface ConfigEmpresa {
  empresa_id: string;
  garantia_activa: boolean;
  garantia_dias_antes: number;
  garantia_horas_limite: number;
  garantia_cancelar_si_falta: boolean;
}

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

  const { data: configs, error: errCfg } = await supabase
    .from("empresa_reservas_config")
    .select(
      "empresa_id, garantia_activa, garantia_dias_antes, garantia_horas_limite, garantia_cancelar_si_falta",
    )
    .eq("garantia_activa", true);

  if (errCfg) {
    console.error("[cron][garantia-tarjeta] configs:", errCfg);
    return NextResponse.json({ error: "Error consultando" }, { status: 500 });
  }

  const ahora = new Date();
  let pedidas = 0;
  let caducadas = 0;
  let marcadas = 0;

  for (const cfg of (configs ?? []) as ConfigEmpresa[]) {
    // ── 1. Pedir la tarjeta a las que ya entran en ventana ──────────────
    const limite = new Date(ahora);
    limite.setDate(limite.getDate() + (cfg.garantia_dias_antes ?? 4));
    const fechaLimite = limite.toISOString().slice(0, 10);

    const { data: aPedir } = await supabase
      .from("reservas")
      .select("id, garantia_token")
      .eq("empresa_id", cfg.empresa_id)
      .eq("tiene_garantia", true)
      .is("garantia_estado", null)
      .is("garantia_solicitada_at", null)
      .gte("fecha", ahora.toISOString().slice(0, 10))
      .lte("fecha", fechaLimite)
      .in("estado", ["CONFIRMADA", "RECONFIRMADA"])
      .limit(MAX_POR_TIRADA);

    for (const r of aPedir ?? []) {
      const vence = new Date(ahora);
      vence.setHours(vence.getHours() + (cfg.garantia_horas_limite ?? 24));

      await supabase
        .from("reservas")
        .update({
          garantia_solicitada_at: ahora.toISOString(),
          garantia_limite_at: vence.toISOString(),
        })
        .eq("id", r.id as string);

      const res = await enviarReservaEmail(r.id as string, "GARANTIA_SOLICITUD", {
        actor: { origen: "AUTOMATICO" },
      });
      if (!res.ok) {
        console.error("[cron][garantia-tarjeta] mail solicitud:", res.error);
      }
      pedidas++;
    }

    // ── 2. Caducar a las que se les pasó el plazo ───────────────────────
    const { data: vencidas } = await supabase
      .from("reservas")
      .select("id")
      .eq("empresa_id", cfg.empresa_id)
      .eq("tiene_garantia", true)
      .is("garantia_estado", null)
      .not("garantia_limite_at", "is", null)
      .lte("garantia_limite_at", ahora.toISOString())
      .is("garantia_cancelada_sin_tarjeta_at", null)
      .in("estado", ["CONFIRMADA", "RECONFIRMADA"])
      .limit(MAX_POR_TIRADA);

    for (const r of vencidas ?? []) {
      if (cfg.garantia_cancelar_si_falta === false) {
        // La empresa prefiere decidirlo a mano: se marca para que salga en el
        // aviso de Sala, pero la reserva NO se toca.
        await supabase
          .from("reservas")
          .update({ garantia_cancelada_sin_tarjeta_at: ahora.toISOString() })
          .eq("id", r.id as string);
        marcadas++;
        continue;
      }

      // Cancelar libera la mesa: el trigger de la reserva devuelve el cupo.
      await supabase
        .from("reservas")
        .update({
          estado: "CANCELADA",
          garantia_cancelada_sin_tarjeta_at: ahora.toISOString(),
        })
        .eq("id", r.id as string);

      const res = await enviarReservaEmail(r.id as string, "GARANTIA_CADUCADA", {
        actor: { origen: "AUTOMATICO" },
      });
      if (!res.ok) {
        console.error("[cron][garantia-tarjeta] mail caducada:", res.error);
      }
      caducadas++;
    }
  }

  return NextResponse.json({ ok: true, pedidas, caducadas, marcadas });
}
