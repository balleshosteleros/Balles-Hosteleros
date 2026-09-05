"use server";

/**
 * Compra de un producto de tipo Ticket desde la tienda pública.
 *
 * El importe NO lo manda el navegador: se lee siempre el precio del producto
 * en la base de datos y se multiplica aquí. Así nadie puede pagar 1 € por un
 * producto de 49 € manipulando la página.
 *
 * Flujo:
 *   1. Se lee el producto y se calcula el importe real.
 *   2. Se crea la compra en estado "pendiente" con su código único.
 *   3. Si el producto es de pago, se crea el pedido en Revolut y se devuelve
 *      la URL de pago. Si es gratuito, la compra queda pagada al momento.
 */

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { crearOrden } from "@/lib/revolut/merchant";
import { getCredencialesRevolut } from "@/features/ajustes/actions/revolut-config-actions";
import { getSiteUrl } from "@/lib/site-url";
import { enviarEmailCompraTicket } from "@/lib/email/tickets/enviar-compra";

const inputSchema = z.object({
  empresaSlug: z.string().min(1).max(120),
  productoId: z.string().uuid(),
  unidades: z.number().int().min(1).max(50),
  nombre: z.string().min(1).max(120),
  email: z.string().email().max(180),
  telefono: z.string().max(40).optional().nullable(),
});

export type ComprarTicketInput = z.input<typeof inputSchema>;

export type ComprarTicketResult =
  | {
      ok: true;
      modo: "pago";
      /** Token del widget: la tarjeta se teclea en NUESTRA pantalla. */
      tokenPago: string;
      entorno: "produccion" | "pruebas";
      compraId: string;
    }
  | { ok: true; modo: "gratis"; codigo: string; compraId: string }
  | { ok: false; error: string };

export async function comprarTicketAction(
  raw: ComprarTicketInput,
): Promise<ComprarTicketResult> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos del formulario." };
  }
  const input = parsed.data;
  const admin = createAdminClient();

  // ── 1. Empresa ────────────────────────────────────────────────────
  const empresa = await admin
    .from("empresas")
    .select("id, nombre")
    .eq("slug", input.empresaSlug)
    .maybeSingle();
  if (empresa.error || !empresa.data) {
    return { ok: false, error: "Restaurante no encontrado." };
  }
  const empresaId = empresa.data.id as string;

  // ── 2. Producto: el precio SIEMPRE sale de aquí ───────────────────
  const prod = await admin
    .from("reserva_ticket_productos")
    .select("id, nombre, precio, iva, modo_precio, personas_por_unidad, activo, venta_publica, cobro_modo, stock_modo, stock_total, stock_consumido, validez_dias, canje_hasta")
    .eq("id", input.productoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (prod.error || !prod.data) {
    return { ok: false, error: "Producto no disponible." };
  }
  const p = prod.data;
  if (!p.activo || !p.venta_publica) {
    return { ok: false, error: "Este producto no está a la venta." };
  }

  // ── 3. Stock ──────────────────────────────────────────────────────
  // "por_persona" consume una unidad por comensal; "por_reserva", una sola.
  //
  // Lo que llega en `input.unidades` son PERSONAS, tal cual las eligió el
  // cliente en el desplegable (2, 4, 6…). Antes eran "paquetes" y se
  // multiplicaban aquí, lo que obligaba al cliente a traducir "1 paquete = 2
  // personas" y le cobraba el doble de lo que creía.
  const unidades = p.modo_precio === "por_persona" ? input.unidades : 1;
  if (p.stock_modo === "limitado" && p.stock_total != null) {
    const libre = Number(p.stock_total) - Number(p.stock_consumido ?? 0);
    if (libre < unidades) {
      return {
        ok: false,
        error: libre <= 0 ? "Producto agotado." : `Solo quedan ${libre} disponibles.`,
      };
    }
  }

  // ── 4. Importe real (IVA incluido, como se muestra al cliente) ────
  const precioBase = Number(p.precio);
  const iva = Number(p.iva ?? 0);
  // El precio que se escribe en el producto es lo que PAGA el cliente, IVA
  // incluido: si pone 49 €, se le cobran 49 €. El IVA no se suma encima, se
  // calcula hacia dentro para la contabilidad (49 € al 10% = 44,55 + 4,45).
  const precioUnitario = Number(precioBase.toFixed(2));
  const importeTotal = Number((precioUnitario * unidades).toFixed(2));
  const esGratis = p.cobro_modo === "gratis" || importeTotal <= 0;

  // ── 5. Caducidad del código ───────────────────────────────────────
  let canjeHasta: string | null = null;
  if (p.canje_hasta) {
    canjeHasta = p.canje_hasta as string;
  } else if (p.validez_dias != null) {
    const d = new Date();
    d.setDate(d.getDate() + Number(p.validez_dias));
    canjeHasta = d.toISOString().slice(0, 10);
  }

  // ── 6. Reservar el stock antes de cobrar ──────────────────────────
  // Si luego el pago falla, se devuelve (ver liberarStock más abajo).
  const consumo = await admin.rpc("consumir_stock_ticket", {
    p_producto_id: input.productoId,
    p_unidades: unidades,
  });
  if (consumo.error) {
    const msg = consumo.error.message ?? "";
    if (msg.includes("AGOTADO")) return { ok: false, error: "Producto agotado." };
    console.error("[comprar-ticket] stock:", consumo.error);
    return { ok: false, error: "No se pudo reservar la disponibilidad." };
  }

  const liberarStock = async () => {
    await admin.rpc("liberar_stock_ticket", {
      p_producto_id: input.productoId,
      p_unidades: unidades,
    });
  };

  // ── 7. Código único ───────────────────────────────────────────────
  const gen = await admin.rpc("generar_codigo_ticket", { p_empresa_id: empresaId });
  if (gen.error || !gen.data) {
    await liberarStock();
    console.error("[comprar-ticket] codigo:", gen.error);
    return { ok: false, error: "No se pudo generar el código." };
  }
  const codigo = gen.data as string;

  // ── 8. Crear la compra ────────────────────────────────────────────
  const compra = await admin
    .from("reserva_ticket_compras")
    .insert({
      empresa_id: empresaId,
      producto_id: input.productoId,
      codigo,
      comprador_nombre: input.nombre.trim(),
      comprador_email: input.email.trim().toLowerCase(),
      comprador_telefono: input.telefono?.trim() || null,
      unidades,
      precio_unitario: precioUnitario,
      iva,
      importe_total: importeTotal,
      estado: esGratis ? "pagada" : "pendiente",
      cobro_modo: esGratis ? "gratis" : "revolut",
      pagado_at: esGratis ? new Date().toISOString() : null,
      canje_hasta: canjeHasta,
    })
    .select("id")
    .single();

  if (compra.error || !compra.data) {
    await liberarStock();
    console.error("[comprar-ticket] insert:", compra.error);
    return { ok: false, error: "No se pudo registrar la compra." };
  }
  const compraId = compra.data.id as string;

  // ── 9a. Producto gratuito: ya está, se envía el código ────────────
  if (esGratis) {
    await enviarEmailCompraTicket(compraId).catch((e) =>
      console.error("[comprar-ticket] email:", e),
    );
    return { ok: true, modo: "gratis", codigo, compraId };
  }

  // ── 9b. Producto de pago: se crea el pedido en Revolut ────────────
  const cred = await getCredencialesRevolut(empresaId);
  if (!cred) {
    await liberarStock();
    await admin.from("reserva_ticket_compras")
      .update({ estado: "fallida" }).eq("id", compraId);
    return {
      ok: false,
      error: "El cobro con tarjeta no está disponible ahora mismo.",
    };
  }

  const orden = await crearOrden({
    secretKey: cred.secretKey,
    entorno: cred.entorno,
    importe: importeTotal,
    referencia: compraId,
    descripcion: `${p.nombre} · ${empresa.data.nombre}`,
    cliente: {
      email: input.email.trim().toLowerCase(),
      nombre: input.nombre.trim(),
      telefono: input.telefono?.trim() || undefined,
    },
    redirectUrl: `${getSiteUrl()}/ticket/${input.empresaSlug}/gracias?compra=${compraId}`,
  });

  if (!orden.ok) {
    await liberarStock();
    await admin.from("reserva_ticket_compras")
      .update({ estado: "fallida" }).eq("id", compraId);
    console.error("[comprar-ticket] revolut:", orden.error);
    return { ok: false, error: "No se pudo iniciar el pago. Inténtalo de nuevo." };
  }

  await admin
    .from("reserva_ticket_compras")
    .update({
      revolut_order_id: orden.orden.id,
      revolut_estado: orden.orden.state,
    })
    .eq("id", compraId);

  // El TOKEN, no la página alojada de Revolut: el formulario de tarjeta se
  // monta dentro de nuestra pantalla, igual que en las políticas de reserva.
  // Su página traía el "Pagar X €", los botones de Revolut Pay y su publicidad.
  const tokenPago = orden.orden.token;
  if (!tokenPago) {
    await liberarStock();
    await admin.from("reserva_ticket_compras")
      .update({ estado: "fallida" }).eq("id", compraId);
    return { ok: false, error: "Revolut no devolvió una página de pago." };
  }

  return { ok: true, modo: "pago", tokenPago, entorno: cred.entorno, compraId };
}
