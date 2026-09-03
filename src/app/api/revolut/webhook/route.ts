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
import {
  firmaWebhookValida,
  estaPagada,
  obtenerOrden,
  tarjetaDeOrden,
  type RevolutOrderState,
} from "@/lib/revolut/merchant";
import { decrypt } from "@/features/accesos/lib/crypto";
import { notificarReservaCreada } from "@/lib/email/reservas/notificar-creada";
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
    // No es un Ticket: puede ser la tarjeta de una reserva (PRP-082).
    const dePolitica = await procesarPoliticaReserva({
      admin,
      orderId,
      referencia: evento.merchant_order_ext_ref ?? null,
      tipoEvento: evento.event ?? "",
      firma,
      timestamp,
      cuerpo,
    });
    if (dePolitica) return NextResponse.json({ ok: true });
    // Cobro ajeno a todo lo nuestro. No es un error.
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
  // Revolut manda ORDER_PAYMENT_FAILED (es el evento al que nos suscribimos);
  // se acepta también ORDER_FAILED por si cambia el nombre.
  if (tipo === "ORDER_CANCELLED" || tipo === "ORDER_FAILED" || tipo === "ORDER_PAYMENT_FAILED") {
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

/**
 * Tarjeta de una reserva (PRP-082 fase 2).
 *
 * La referencia que enviamos al crear la orden dice qué política se estaba
 * pagando: "garantia:<id>" o "cancelacion:<id>". Con eso se sabe qué columnas
 * tocar sin tener que adivinarlo.
 *
 * Devuelve true si el evento era de una reserva (aunque no hubiera nada que
 * cambiar), para que quien llama no siga buscando.
 */
async function procesarPoliticaReserva(input: {
  admin: ReturnType<typeof createAdminClient>;
  orderId: string;
  referencia: string | null;
  tipoEvento: string;
  firma: string;
  timestamp: string;
  cuerpo: string;
}): Promise<boolean> {
  const { admin, orderId, referencia, tipoEvento } = input;

  const m = /^(garantia|cancelacion):([0-9a-f-]{36})$/.exec(referencia ?? "");
  const prefijo = m?.[1] as "garantia" | "cancelacion" | undefined;

  const { data: reserva } = await admin
    .from("reservas")
    .select("id, empresa_id, garantia_estado, cancelacion_estado")
    .or(
      `garantia_revolut_order_id.eq.${orderId},cancelacion_revolut_order_id.eq.${orderId}` +
        (m ? `,id.eq.${m[2]}` : ""),
    )
    .maybeSingle();
  if (!reserva) return false;

  // La firma se valida con el secreto DE ESA EMPRESA, igual que en los
  // tickets: sin esto, cualquiera podría marcar una garantía como retenida.
  const { data: cfg } = await admin
    .from("empresa_revolut_config")
    .select("webhook_secret_cifrado, secret_key_cifrada, entorno")
    .eq("empresa_id", reserva.empresa_id as string)
    .maybeSingle();
  if (!cfg?.webhook_secret_cifrado) return true;

  let secreto: string;
  try {
    secreto = decrypt(cfg.webhook_secret_cifrado as string);
  } catch {
    return true;
  }
  const valida = await firmaWebhookValida({
    signingSecret: secreto,
    cabeceraSignature: input.firma,
    cabeceraTimestamp: input.timestamp,
    cuerpoCrudo: input.cuerpo,
  });
  if (!valida) {
    console.error("[revolut][webhook] firma inválida (reserva)");
    return true;
  }

  const p = prefijo ?? "garantia";
  const estadoActual = reserva[`${p}_estado`] as string | null;
  // Un cobro ya hecho no se revierte por un evento que llegue tarde.
  if (estadoActual === "cobrada") return true;

  if (tipoEvento === "ORDER_AUTHORISED" || tipoEvento === "ORDER_COMPLETED") {
    // La garantía queda RETENIDA (el dinero está apartado); la cancelación
    // deja la tarjeta GUARDADA para poder cobrar más adelante.
    const nuevo = p === "garantia" ? "retenida" : "guardada";
    if (estadoActual === nuevo) return true;

    // El aviso no trae la tarjeta, así que se le pregunta a Revolut. Sin estas
    // referencias (cliente + método guardado) la política de cancelación no
    // podría cobrar el no-show: quedaría "guardada" sin tarjeta que cobrar.
    let refs: Record<string, unknown> = {};
    if (cfg.secret_key_cifrada) {
      try {
        const orden = await obtenerOrden(
          decrypt(cfg.secret_key_cifrada as string),
          ((cfg.entorno as string) ?? "produccion") as "produccion" | "pruebas",
          orderId,
        );
        if (orden.ok) {
          const tarjeta = tarjetaDeOrden(orden.orden);
          refs = {
            [`${p}_tarjeta_ultimos4`]: tarjeta?.ultimos4 ?? null,
            [`${p}_tarjeta_marca`]: tarjeta?.marca ?? null,
            ...(p === "cancelacion"
              ? {
                  cancelacion_customer_id: orden.orden.customer?.id ?? null,
                  cancelacion_payment_method_id: tarjeta?.id ?? null,
                }
              : {}),
            ...(p === "garantia" && orden.orden.capture_deadline
              ? { garantia_capture_deadline: orden.orden.capture_deadline }
              : {}),
          };
        }
      } catch (e) {
        console.error("[revolut][webhook] no se pudo leer la tarjeta:", e);
      }
    }

    await admin
      .from("reservas")
      .update({
        ...refs,
        [`${p}_estado`]: nuevo,
        [`${p}_${p === "garantia" ? "retenida" : "guardada"}_at`]: new Date().toISOString(),
        // Pagada: deja de ser provisional y pasa a ser una reserva de verdad.
        provisional_hasta: null,
      })
      .eq("id", reserva.id as string);
    // El alta retuvo la confirmación para no decir "confirmada" mientras el
    // cliente aún tenía que pagar. Ya ha pagado: se le escribe.
    //
    // `notificarReservaCreada` es idempotente (marca `email_confirmacion_at`),
    // así que no duplica si el cliente ya volvió de Revolut y se envió allí.
    notificarReservaCreada(reserva.id as string).catch((e) =>
      console.error("[revolut][webhook] mail CONFIRMACION:", e),
    );
    return true;
  }

  if (
    tipoEvento === "ORDER_CANCELLED" ||
    tipoEvento === "ORDER_FAILED" ||
    tipoEvento === "ORDER_PAYMENT_FAILED"
  ) {
    await admin
      .from("reservas")
      .update({
        [`${p}_estado`]: tipoEvento === "ORDER_CANCELLED" ? "liberada" : "fallida",
      })
      .eq("id", reserva.id as string);
    return true;
  }

  return true;
}
