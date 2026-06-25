"use server";

/**
 * §4 Envío real del pedido al proveedor.
 * - enviarPedidoEmail: genera el PDF y lo manda por email a `proveedores.email_pedidos`
 *   (cae a `email_principal`). Marca `estado='Enviado'` solo si el email sale OK
 *   (Regla de Seguridad: ante fallo, no marca y devuelve el error exacto).
 * - prepararWhatsappPedido: devuelve la URL wa.me con el resumen del pedido (texto) para
 *   abrir WhatsApp desde el cliente. El PDF por WhatsApp queda para cuando se monte la
 *   API Business de Meta (no configurada aún).
 *
 * Sin migración: registro mínimo vía `estado='Enviado'`. Las columnas finas
 * (enviado_at/canal/email) quedan propuestas para que Iván decida sobre el esquema.
 */
import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import { generarPedidoPDF, type LineaPedidoPDF } from "@/features/logistica/lib/pedido-pdf";
import { sendEmail } from "@/lib/email/send";

type LineaRow = {
  producto_nombre: string;
  cantidad: number | string;
  unidad: string | null;
  precio_unitario: number | string;
  total: number | string;
};

async function cargarPedido(
  supabase: Awaited<ReturnType<typeof getLogisticaContext>>["supabase"],
  id: string,
) {
  const { data: pedido, error } = await supabase.from("pedidos").select("*").eq("id", id).single();
  if (error) throw error;
  const { data: lineas } = await supabase
    .from("lineas_pedido").select("*").eq("pedido_id", id).order("orden", { ascending: true });
  let proveedor: {
    nombre_comercial: string | null;
    email_pedidos: string | null;
    email_principal: string | null;
    telefono_principal: string | null;
    telefono_comercial: string | null;
  } | null = null;
  if (pedido.proveedor_id) {
    const { data } = await supabase
      .from("proveedores")
      .select("nombre_comercial, email_pedidos, email_principal, telefono_principal, telefono_comercial")
      .eq("id", pedido.proveedor_id).single();
    proveedor = data;
  }
  let empresaNombre = "Balles Hosteleros";
  if (pedido.empresa_id) {
    const { data } = await supabase.from("empresas").select("nombre").eq("id", pedido.empresa_id).single();
    if (data?.nombre) empresaNombre = data.nombre as string;
  }
  return { pedido, lineas: (lineas ?? []) as LineaRow[], proveedor, empresaNombre };
}

function aLineasPDF(lineas: LineaRow[]): LineaPedidoPDF[] {
  return lineas.map((l) => ({
    producto: l.producto_nombre,
    cantidad: Number(l.cantidad),
    unidad: l.unidad ?? "ud",
    precioUnitario: Number(l.precio_unitario),
    total: Number(l.total),
  }));
}

export async function enviarPedidoEmail(pedidoId: string): Promise<{ ok: boolean; email?: string; error?: string }> {
  try {
    const { supabase } = await getLogisticaContext();
    const { pedido, lineas, proveedor, empresaNombre } = await cargarPedido(supabase, pedidoId);

    const email = (proveedor?.email_pedidos?.trim() || proveedor?.email_principal?.trim() || "");
    if (!email) return { ok: false, error: "El proveedor no tiene email de pedidos configurado." };

    const ref = pedido.numero || String(pedido.id).slice(0, 8);
    const pdf = await generarPedidoPDF({
      empresaNombre,
      proveedorNombre: pedido.proveedor_nombre || proveedor?.nombre_comercial || "Proveedor",
      proveedorEmail: email,
      numero: pedido.numero,
      fecha: pedido.fecha,
      fechaEntrega: pedido.fecha_entrega,
      notas: pedido.notas,
      lineas: aLineasPDF(lineas),
      total: Number(pedido.total) || 0,
    });

    const html = `<p>Buenos días,</p><p>Adjuntamos nuestro pedido <strong>${ref}</strong>. El detalle está en el PDF adjunto.</p><p>Un saludo,<br/>${empresaNombre}</p>`;
    const text = `Buenos dias,\n\nAdjuntamos nuestro pedido ${ref}. El detalle esta en el PDF adjunto.\n\nUn saludo,\n${empresaNombre}`;

    const res = await sendEmail({
      to: email,
      subject: `Pedido ${ref} — ${empresaNombre}`,
      html,
      text,
      empresaId: pedido.empresa_id ?? undefined,
      fromName: empresaNombre,
      attachments: [{ filename: `pedido-${ref}.pdf`, content: pdf, contentType: "application/pdf" }],
    });

    if (!res.ok) {
      const msg = res.configured === false
        ? "El email del sistema no está configurado (SMTP)."
        : ("error" in res ? res.error : "No se pudo enviar el email.");
      return { ok: false, error: msg };
    }

    await supabase.from("pedidos").update({ estado: "Enviado", updated_at: new Date().toISOString() }).eq("id", pedidoId);
    return { ok: true, email };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pedidos] enviarPedidoEmail:", msg);
    return { ok: false, error: msg };
  }
}

export async function prepararWhatsappPedido(pedidoId: string): Promise<{ ok: boolean; url?: string; telefono?: string | null; error?: string }> {
  try {
    const { supabase } = await getLogisticaContext();
    const { pedido, lineas, proveedor, empresaNombre } = await cargarPedido(supabase, pedidoId);
    const tel = (proveedor?.telefono_principal || proveedor?.telefono_comercial || "")
      .replace(/[^\d+]/g, "").replace(/^\+/, "");
    const ref = pedido.numero || String(pedido.id).slice(0, 8);
    const lineasTxt = lineas.map((l) => `• ${l.producto_nombre}: ${Number(l.cantidad)} ${l.unidad ?? "ud"}`).join("\n");
    const texto = `*Pedido ${ref} — ${empresaNombre}*\n${lineasTxt}\nTotal: ${(Number(pedido.total) || 0).toFixed(2)} €\n(Te enviamos el PDF por email.)`;
    const url = `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
    return { ok: true, url, telefono: tel || null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pedidos] prepararWhatsappPedido:", msg);
    return { ok: false, error: msg };
  }
}
