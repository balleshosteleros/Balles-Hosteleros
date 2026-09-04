/**
 * Cron: cuadre de los cobros de reserva contra Revolut.
 *
 * Ningún cobro se da por hecho ni por fallido sin que Revolut lo confirme. Un
 * cobro cuya llamada se perdió a mitad puede haber salido igualmente, y el
 * dinero estar ya fuera de la tarjeta del cliente: darlo por fallido hace que
 * se reintente y se cobre dos veces.
 *
 * Esto resuelve esos casos por el único camino que da certeza: preguntarle a
 * Revolut por la referencia que le mandamos al lanzar el cobro.
 *
 * Corre cada hora. Autorización: Bearer ${CRON_SECRET}.
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCredencialesRevolut } from "@/features/ajustes/actions/revolut-config-actions";
import {
  buscarOrdenesPorReferencia,
  resultadoDeOrden,
  netoCobradoDeOrden,
} from "@/lib/revolut/merchant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Tope por tirada: el resto espera a la vuelta siguiente. */
const MAX_POR_TIRADA = 50;

/**
 * Margen antes de preguntar por un cobro recién lanzado.
 *
 * Un cobro en curso tarda unos segundos en resolverse. Sin esta espera se
 * preguntaría por operaciones que aún están vivas y se leerían como perdidas.
 */
const MINUTOS_DE_GRACIA = 5;

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

  const limite = new Date(Date.now() - MINUTOS_DE_GRACIA * 60_000).toISOString();

  // Todo lo que quedó sin respuesta: lanzados que nunca se cerraron y los que
  // ya se marcaron como desconocidos.
  const { data: dudosos, error } = await supabase
    .from("reserva_cobros")
    .select("id, empresa_id, reserva_id, concepto, referencia, importe")
    .in("estado", ["lanzado", "desconocido"])
    .lt("created_at", limite)
    .order("created_at", { ascending: true })
    .limit(MAX_POR_TIRADA);

  if (error) {
    console.error("[cron][cobros-cuadre] consulta:", error);
    return NextResponse.json({ error: "Error consultando" }, { status: 500 });
  }

  let resueltos = 0;
  let cobrados = 0;
  let fallidos = 0;
  let sinRespuesta = 0;

  for (const c of dudosos ?? []) {
    const cred = await getCredencialesRevolut(c.empresa_id as string);
    if (!cred) continue;

    const res = await buscarOrdenesPorReferencia(
      cred.secretKey,
      cred.entorno,
      c.referencia as string,
    );
    if (!res.ok) {
      sinRespuesta++;
      continue;
    }

    const ahora = new Date().toISOString();

    // Sin orden con esa referencia, el cobro nunca llegó a crearse: no salió
    // dinero. Solo entonces se puede dar por fallido sin riesgo.
    if (res.ordenes.length === 0) {
      await supabase
        .from("reserva_cobros")
        .update({
          estado: "fallido",
          error: "Revolut no tiene ninguna orden con esta referencia: el cobro no llegó a salir.",
          comprobado_at: ahora,
          updated_at: ahora,
        })
        .eq("id", c.id as string);
      await supabase
        .from("reservas")
        .update({ cancelacion_estado: "guardada", cancelacion_error: null })
        .eq("id", c.reserva_id as string)
        .eq("cancelacion_estado", "desconocida");
      resueltos++;
      fallidos++;
      continue;
    }

    const orden = res.ordenes[0];
    const resultado = resultadoDeOrden(orden);

    if (resultado === "en_curso") {
      sinRespuesta++;
      continue;
    }

    if (resultado === "cobrado") {
      // El dinero salió de verdad. Se apunta el neto (descontando lo que se
      // haya devuelto) y la reserva pasa a cobrada.
      const neto = netoCobradoDeOrden(orden);
      await supabase
        .from("reserva_cobros")
        .update({
          estado: "cobrado",
          importe: neto,
          revolut_order_id: orden.id,
          revolut_estado: String(orden.state),
          error: null,
          comprobado_at: ahora,
          updated_at: ahora,
        })
        .eq("id", c.id as string);
      await supabase
        .from("reservas")
        .update({
          cancelacion_estado: "cobrada",
          cancelacion_cobrada_at: ahora,
          cancelacion_proximo_intento_at: null,
          cancelacion_error: null,
        })
        .eq("id", c.reserva_id as string);
      resueltos++;
      cobrados++;
      continue;
    }

    if (resultado === "devuelto") {
      await supabase
        .from("reserva_cobros")
        .update({
          estado: "devuelto",
          importe: -Math.abs(Number(c.importe ?? 0)),
          revolut_order_id: orden.id,
          revolut_estado: String(orden.state),
          comprobado_at: ahora,
          updated_at: ahora,
        })
        .eq("id", c.id as string);
      resueltos++;
      continue;
    }

    // Rechazo explícito: la orden existe y Revolut dice que no se cobró.
    await supabase
      .from("reserva_cobros")
      .update({
        estado: "fallido",
        revolut_order_id: orden.id,
        revolut_estado: String(orden.state),
        comprobado_at: ahora,
        updated_at: ahora,
      })
      .eq("id", c.id as string);
    await supabase
      .from("reservas")
      .update({ cancelacion_estado: "fallida" })
      .eq("id", c.reserva_id as string)
      .eq("cancelacion_estado", "desconocida");
    resueltos++;
    fallidos++;
  }

  return NextResponse.json({
    ok: true,
    revisados: (dudosos ?? []).length,
    resueltos,
    cobrados,
    fallidos,
    sinRespuesta,
  });
}
