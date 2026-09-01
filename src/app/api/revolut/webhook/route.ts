/**
 * Webhook de Revolut: avisa cuando un pago se completa o falla.
 *
 * Es la fuente de verdad del cobro. No se confía en que el cliente vuelva a la
 * página de "gracias" (puede cerrar el navegador): el dinero se da por cobrado
 * cuando Revolut lo dice aquí.
 *
 * Seguridad: se comprueba la firma HMAC del cuerpo antes de hacer nada.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { firmaWebhookValida, estaPagada, type RevolutOrderState } from "@/lib/revolut/merchant";
import { decrypt } from "@/features/accesos/lib/crypto";
import { enviarEmailCompraTicket } from "@/lib/email/tickets/enviar-compra";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface EventoRevolut {
  event?: string;
  order_id?: string;
  merchant_order_ext_ref?: string;
}

export async function POST(req: Request) {
  // El cuerpo CRUDO es imprescindible: la firma se calcula sobre el texto tal
  // cual llegó. Si se parsea y se vuelve a serializar, la firma ya no cuadra.
  const cuerpo = await req.text();
  const firma = req.headers.get("revolut-signature");
  const timestamp = req.headers.get("revolut-request-timestamp");

  if (!firma || !timestamp) {
    return NextResponse.json({ error: "Faltan cabeceras de firma" }, { status: 401 });
  }

  let evento: EventoRevolut;
  try {
    evento = JSON.parse(cuerpo) as EventoRevolut;
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const orderId = evento.order_id;
  if (!orderId) {
    // Evento que no va de un pedido: se acepta para que Revolut no reintente.
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();

  // Se localiza la compra por el id de pedido de Revolut, y si no, por nuestra
  // referencia externa (que es el id de la compra).
  const { data: compra } = await admin
    .from("reserva_ticket_compras")
    .select("id, empresa_id, estado, producto_id, unidades")
    .or(
      `revolut_order_id.eq.${orderId}` +
        (evento.merchant_order_ext_ref ? `,id.eq.${evento.merchant_order_ext_ref}` : ""),
    )
    .maybeSingle();

  if (!compra) {
    // Puede ser un cobro ajeno a los tickets. No es un error.
    return NextResponse.json({ ok: true });
  }

  // La firma se valida con el secreto DE ESA EMPRESA.
  const { data: cfg } = await admin
    .from("empresa_revolut_config")
    .select("webhook_secret_cifrado")
    .eq("empresa_id", compra.empresa_id as string)
    .maybeSingle();

  if (!cfg?.webhook_secret_cifrado) {
    console.error("[revolut][webhook] sin secreto de firma configurado");
    return NextResponse.json({ error: "No configurado" }, { status: 401 });
  }

  let secreto: string;
  try {
    secreto = decrypt(cfg.webhook_secret_cifrado as string);
  } catch {
    return NextResponse.json({ error: "Secreto ilegible" }, { status: 500 });
  }

  const valida = await firmaWebhookValida({
    signingSecret: secreto,
    cabeceraSignature: firma,
    cabeceraTimestamp: timestamp,
    cuerpoCrudo: cuerpo,
  });
  if (!valida) {
    console.error("[revolut][webhook] firma inválida");
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  const tipo = evento.event ?? "";
  const compraId = compra.id as string;

  // ── Pago completado ───────────────────────────────────────────────
  if (tipo === "ORDER_COMPLETED" || tipo === "ORDER_AUTHORISED") {
    const estadoRevolut: RevolutOrderState =
      tipo === "ORDER_COMPLETED" ? "COMPLETED" : "AUTHORISED";

    if (!estaPagada(estadoRevolut)) return NextResponse.json({ ok: true });

    // Solo se marca pagada si seguía pendiente: evita reprocesar reenvíos.
    if (compra.estado === "pendiente") {
      await admin
        .from("reserva_ticket_compras")
        .update({
          estado: "pagada",
          revolut_estado: estadoRevolut,
          revolut_order_id: orderId,
          pagado_at: new Date().toISOString(),
        })
        .eq("id", compraId)
        .eq("estado", "pendiente");
    }

    // El correo es idempotente por dentro: no se duplica si el webhook repite.
    await enviarEmailCompraTicket(compraId).catch((e) =>
      console.error("[revolut][webhook] email:", e),
    );

    return NextResponse.json({ ok: true });
  }

  // ── Pago fallido o cancelado: se devuelve el stock reservado ──────
  if (tipo === "ORDER_CANCELLED" || tipo === "ORDER_FAILED") {
    if (compra.estado === "pendiente") {
      await admin
        .from("reserva_ticket_compras")
        .update({
          estado: tipo === "ORDER_CANCELLED" ? "cancelada" : "fallida",
          revolut_estado: tipo === "ORDER_CANCELLED" ? "CANCELLED" : "FAILED",
        })
        .eq("id", compraId)
        .eq("estado", "pendiente");

      await admin.rpc("liberar_stock_ticket", {
        p_producto_id: compra.producto_id as string,
        p_unidades: Number(compra.unidades),
      });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
