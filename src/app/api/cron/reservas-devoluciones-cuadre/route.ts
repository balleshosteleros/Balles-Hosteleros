/**
 * Cron: cuadre de las DEVOLUCIONES contra Revolut.
 *
 * El software no es el único sitio desde el que se puede devolver dinero: se
 * devuelve también a mano desde el panel de Revolut, y entonces la pantalla de
 * cobros seguía enseñando el cobro entero como si nadie hubiera tocado nada.
 * Al revés pasaba lo mismo: una devolución lanzada desde aquí que el banco del
 * cliente rechaza queda marcada como fallida, y si alguien la repite por otra
 * vía y esa sí entra, el software no se entera.
 *
 * La regla es la de siempre en esta tabla: manda Revolut. Aquí se le pregunta
 * cuánto se ha devuelto DE VERDAD de cada cobro y se ajusta lo que tengamos
 * apuntado, venga la devolución de donde venga.
 *
 * Corre cada hora. Autorización: Bearer ${CRON_SECRET}.
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCredencialesRevolut } from "@/features/ajustes/actions/revolut-config-actions";
import { obtenerOrden, aEuros } from "@/lib/revolut/merchant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Tope por tirada: el resto espera a la vuelta siguiente. */
const MAX_POR_TIRADA = 60;

interface Cobro {
  orderId: string;
  empresaId: string;
  reservaId: string | null;
  compraId: string | null;
  concepto: "garantia" | "cancelacion" | "ticket";
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // ── Todo el dinero que se ha llegado a cobrar ─────────────────────
  const cobros: Cobro[] = [];

  const { data: compras } = await supabase
    .from("reserva_ticket_compras")
    .select("id, empresa_id, reserva_id, revolut_order_id")
    .not("pagado_at", "is", null)
    .not("revolut_order_id", "is", null)
    .limit(MAX_POR_TIRADA);

  for (const c of compras ?? []) {
    cobros.push({
      orderId: c.revolut_order_id as string,
      empresaId: c.empresa_id as string,
      // Si ya se canjeó, el movimiento cuelga de la reserva; si no, de la compra.
      reservaId: (c.reserva_id as string | null) ?? null,
      compraId: c.reserva_id ? null : (c.id as string),
      concepto: "ticket",
    });
  }

  const { data: reservas } = await supabase
    .from("reservas")
    .select(
      "id, empresa_id, garantia_estado, garantia_revolut_order_id, cancelacion_estado, cancelacion_revolut_order_id",
    )
    .or("garantia_estado.eq.cobrada,cancelacion_estado.eq.cobrada")
    .limit(MAX_POR_TIRADA);

  for (const r of reservas ?? []) {
    if (r.garantia_estado === "cobrada" && r.garantia_revolut_order_id) {
      cobros.push({
        orderId: r.garantia_revolut_order_id as string,
        empresaId: r.empresa_id as string,
        reservaId: r.id as string,
        compraId: null,
        concepto: "garantia",
      });
    }
    if (r.cancelacion_estado === "cobrada" && r.cancelacion_revolut_order_id) {
      cobros.push({
        orderId: r.cancelacion_revolut_order_id as string,
        empresaId: r.empresa_id as string,
        reservaId: r.id as string,
        compraId: null,
        concepto: "cancelacion",
      });
    }
  }

  // Las credenciales son por empresa y se piden una sola vez cada una.
  const credenciales = new Map<
    string,
    Awaited<ReturnType<typeof getCredencialesRevolut>>
  >();

  let ajustados = 0;
  const incidencias: string[] = [];

  for (const cobro of cobros.slice(0, MAX_POR_TIRADA)) {
    if (!credenciales.has(cobro.empresaId)) {
      credenciales.set(cobro.empresaId, await getCredencialesRevolut(cobro.empresaId));
    }
    const cred = credenciales.get(cobro.empresaId) ?? null;
    if (!cred) continue;

    const orden = await obtenerOrden(cred.secretKey, cred.entorno, cobro.orderId);
    if (!orden.ok) {
      incidencias.push(`${cobro.orderId}: Revolut no responde`);
      continue;
    }

    // Lo que Revolut dice que se ha devuelto de este cobro, venga de donde venga.
    const devueltoReal = aEuros(Number(orden.orden.refunded_amount ?? 0));

    // Lo que tenemos apuntado como devuelto DE VERDAD (los intentos fallidos
    // no cuentan: ahí no salió dinero).
    const query = supabase
      .from("reserva_cobros")
      .select("importe")
      .eq("concepto", cobro.concepto)
      .eq("estado", "devuelto");
    const { data: apuntes } = await (cobro.compraId
      ? query.eq("compra_id", cobro.compraId)
      : query.eq("reserva_id", cobro.reservaId ?? ""));

    const devueltoApuntado = (apuntes ?? []).reduce(
      (total, a) => total + Math.abs(Number(a.importe ?? 0)),
      0,
    );

    const diferencia = Number((devueltoReal - devueltoApuntado).toFixed(2));
    if (diferencia <= 0) continue;

    // Falta apuntar dinero devuelto: alguien lo devolvió por fuera, o un
    // intento que dimos por fallido acabó entrando.
    const { error } = await supabase.from("reserva_cobros").insert({
      empresa_id: cobro.empresaId,
      reserva_id: cobro.reservaId,
      compra_id: cobro.compraId,
      concepto: cobro.concepto,
      importe: -diferencia,
      estado: "devuelto",
      referencia: `cuadre-${cobro.orderId.slice(0, 8)}-${Date.now()}`,
      revolut_order_id: cobro.orderId,
      revolut_estado: String(orden.orden.state ?? ""),
      error: "Devolución hecha fuera del software: la confirma Revolut",
      comprobado_at: new Date().toISOString(),
    });
    if (error) {
      incidencias.push(`${cobro.orderId}: no se pudo apuntar la devolución`);
      continue;
    }
    ajustados += 1;
  }

  return NextResponse.json({
    ok: true,
    revisados: Math.min(cobros.length, MAX_POR_TIRADA),
    ajustados,
    incidencias,
  });
}
