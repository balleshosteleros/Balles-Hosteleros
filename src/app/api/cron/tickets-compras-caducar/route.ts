/**
 * Cron: cierra las compras de ticket que se quedaron a medias.
 *
 * Una compra nace `pendiente` ANTES de teclear la tarjeta: se aparta el stock,
 * se genera el código y se abre un pedido en Revolut. Si el cliente cierra la
 * pestaña ahí, esa fila se quedaba pendiente PARA SIEMPRE, y con ella:
 *
 *   · Un enlace de pago vivo indefinidamente. Alguien podía pagarlo semanas
 *     después, al precio congelado del día que lo abrió, y el software le
 *     mandaba el código tan tranquilo. Subir el precio del producto no cerraba
 *     esos enlaces: seguían cobrando el viejo.
 *   · Stock apartado que nadie devolvía. Con existencias limitadas, tres
 *     personas que abran el pago y no lo terminen agotan el producto.
 *
 * Antes de cerrar nada se le PREGUNTA A REVOLUT, que es el único que sabe si
 * salió dinero. Si resulta que sí se pagó —un aviso de Revolut que se perdió—
 * la compra se rescata: se marca pagada y se le manda su código. Solo se
 * caduca lo que Revolut confirma que nunca llegó a cobrarse.
 *
 * Se ejecuta cada 10 minutos; el plazo para pagar son 30.
 *
 * Autorización: Bearer ${CRON_SECRET}.
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCredencialesRevolut } from "@/features/ajustes/actions/revolut-config-actions";
import { obtenerOrden, liberarOrden, estaPagada } from "@/lib/revolut/merchant";
import { enviarEmailCompraTicket } from "@/lib/email/tickets/enviar-compra";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Minutos que se le dan al cliente para teclear la tarjeta. */
const MINUTOS_PARA_PAGAR = 30;

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

  const limite = new Date(Date.now() - MINUTOS_PARA_PAGAR * 60_000).toISOString();

  const { data, error } = await supabase
    .from("reserva_ticket_compras")
    .select("id, empresa_id, producto_id, unidades, revolut_order_id, codigo")
    .eq("estado", "pendiente")
    .eq("cobro_modo", "revolut")
    .lt("created_at", limite);

  if (error) {
    console.error("[cron tickets-caducar] lectura:", error);
    return NextResponse.json({ error: "No se pudo leer las compras" }, { status: 500 });
  }

  const compras = data ?? [];
  let caducadas = 0;
  let rescatadas = 0;
  const incidencias: string[] = [];

  // Las credenciales son por empresa y se piden una sola vez cada una: son
  // lecturas cifradas, no hace falta repetirlas por cada compra.
  const credenciales = new Map<
    string,
    Awaited<ReturnType<typeof getCredencialesRevolut>>
  >();

  for (const compra of compras) {
    const empresaId = compra.empresa_id as string;
    if (!credenciales.has(empresaId)) {
      credenciales.set(empresaId, await getCredencialesRevolut(empresaId));
    }
    const cred = credenciales.get(empresaId) ?? null;
    const orderId = compra.revolut_order_id as string | null;

    // Sin pedido en Revolut no hay nada que cobrar ni que cancelar: nunca
    // llegó a abrirse la pasarela.
    if (orderId && cred) {
      const orden = await obtenerOrden(cred.secretKey, cred.entorno, orderId);

      // Revolut no contesta: no se toca nada. Cerrar a ciegas una compra que
      // quizá esté pagada dejaría a un cliente sin su código.
      if (!orden.ok) {
        incidencias.push(`${compra.codigo}: Revolut no responde (${orden.error})`);
        continue;
      }

      // Se pagó y el aviso se perdió por el camino: se rescata.
      if (estaPagada(orden.orden.state)) {
        const { error: errRescate } = await supabase
          .from("reserva_ticket_compras")
          .update({
            estado: "pagada",
            revolut_estado: orden.orden.state,
            pagado_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", compra.id)
          .eq("estado", "pendiente");

        if (errRescate) {
          incidencias.push(`${compra.codigo}: pagada pero no se pudo marcar`);
          continue;
        }
        await enviarEmailCompraTicket(compra.id as string).catch((e) =>
          console.error("[cron tickets-caducar] email:", e),
        );
        rescatadas += 1;
        continue;
      }

      // No se pagó: se cierra el enlace para que no pueda pagarse más tarde.
      const cancelada = await liberarOrden(cred.secretKey, cred.entorno, orderId);
      if (!cancelada.ok) {
        incidencias.push(`${compra.codigo}: no se pudo cerrar el enlace`);
      }
    }

    // El stock se devuelve ANTES de marcar la compra: si el proceso muriese
    // entre las dos, la compra sigue pendiente y el siguiente barrido lo
    // reintenta. Al revés se perdería el cupo sin que nadie lo notase.
    await supabase.rpc("liberar_stock_ticket", {
      p_producto_id: compra.producto_id,
      p_unidades: compra.unidades,
    });

    const { error: errCaducar } = await supabase
      .from("reserva_ticket_compras")
      .update({ estado: "caducada", updated_at: new Date().toISOString() })
      .eq("id", compra.id)
      .eq("estado", "pendiente");

    if (errCaducar) {
      incidencias.push(`${compra.codigo}: no se pudo caducar`);
      continue;
    }
    caducadas += 1;
  }

  return NextResponse.json({
    ok: true,
    revisadas: compras.length,
    caducadas,
    rescatadas,
    incidencias,
  });
}
