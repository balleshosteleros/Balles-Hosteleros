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
import { evaluarReparto, describirReparto, type RepartoProveedor } from "@/features/logistica/data/pedidos";
import { sendEmail } from "@/lib/email/send";

/** Extrae el mensaje real de un error (los errores de Supabase NO son instanceof Error). */
function mensajeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return "Error desconocido";
}

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
  let reparto: RepartoProveedor | null = null;
  if (pedido.proveedor_id) {
    const { data } = await supabase
      .from("proveedores")
      .select("nombre_comercial, email_pedidos, email_principal, telefono_principal, telefono_comercial, dias_reparto, horario_reparto, dias_reparto_negociados, horario_reparto_negociado, dia_reparto_principal")
      .eq("id", pedido.proveedor_id).single();
    proveedor = data;
    if (data) {
      const diasNeg = (data.dias_reparto_negociados as string[] | null) ?? [];
      const dias = diasNeg.length > 0 ? diasNeg : ((data.dias_reparto as string[] | null) ?? []);
      const horario = (diasNeg.length > 0
        ? (data.horario_reparto_negociado as Record<string, string> | null)
        : (data.horario_reparto as Record<string, string> | null)) ?? {};
      reparto = { dias, horario, principal: (data.dia_reparto_principal as string | null) ?? null };
    }
  }
  let empresaNombre = "Balles Hosteleros";
  if (pedido.empresa_id) {
    const { data } = await supabase.from("empresas").select("nombre").eq("id", pedido.empresa_id).single();
    if (data?.nombre) empresaNombre = data.nombre as string;
  }
  return { pedido, lineas: (lineas ?? []) as LineaRow[], proveedor, reparto, empresaNombre };
}

/** Referencia visible del pedido: el Nº libre si existe, si no el ID correlativo PED-x. */
function refPedido(pedido: { numero?: string | null; numero_secuencial?: number | null; id: string }): string {
  if (pedido.numero) return pedido.numero;
  if (pedido.numero_secuencial != null) return `PED-${pedido.numero_secuencial}`;
  return String(pedido.id).slice(0, 8);
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
    const { pedido, lineas, proveedor, reparto, empresaNombre } = await cargarPedido(supabase, pedidoId);

    const email = (proveedor?.email_pedidos?.trim() || proveedor?.email_principal?.trim() || "");
    if (!email) return { ok: false, error: "El proveedor no tiene email de pedidos configurado." };

    const evalRep = evaluarReparto(pedido.fecha_entrega, pedido.hora_entrega, pedido.hora_entrega_hasta, reparto);
    const ref = refPedido(pedido);
    const pdf = await generarPedidoPDF({
      empresaNombre,
      proveedorNombre: pedido.proveedor_nombre || proveedor?.nombre_comercial || "Proveedor",
      proveedorEmail: email,
      numero: ref,
      fecha: pedido.fecha,
      fechaEntrega: pedido.fecha_entrega,
      horaEntrega: pedido.hora_entrega,
      horaEntregaHasta: pedido.hora_entrega_hasta,
      diaSemanaReparto: evalRep.diaSemana,
      franjaProveedor: evalRep.franjaProveedor,
      diasProveedor: reparto?.dias ?? [],
      repartoProveedorTexto: describirReparto(reparto),
      repartoFueraDia: evalRep.fueraDia,
      repartoFueraHora: evalRep.fueraHora,
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
      attachments: [{ filename: `${ref}.pdf`, content: pdf, contentType: "application/pdf" }],
    });

    if (!res.ok) {
      const msg = res.configured === false
        ? "El email del sistema no está configurado (SMTP)."
        : ("error" in res ? res.error : "No se pudo enviar el email.");
      return { ok: false, error: msg };
    }

    const { error: updErr } = await supabase
      .from("pedidos")
      .update({ estado: "Enviado", updated_at: new Date().toISOString() })
      .eq("id", pedidoId);
    // El email ya salió: si el marcado de estado falla, lo registramos pero NO
    // damos el envío por fallido (el proveedor ya recibió el pedido).
    if (updErr) console.error("[pedidos] enviarPedidoEmail update estado:", JSON.stringify(updErr));
    return { ok: true, email };
  } catch (err) {
    console.error("[pedidos] enviarPedidoEmail RAW:", JSON.stringify(err), err);
    return { ok: false, error: mensajeError(err) };
  }
}

export async function prepararWhatsappPedido(pedidoId: string): Promise<{ ok: boolean; url?: string; telefono?: string | null; error?: string }> {
  try {
    const { supabase } = await getLogisticaContext();
    const { pedido, lineas, proveedor, empresaNombre } = await cargarPedido(supabase, pedidoId);
    const tel = (proveedor?.telefono_principal || proveedor?.telefono_comercial || "")
      .replace(/[^\d+]/g, "").replace(/^\+/, "");
    const ref = refPedido(pedido);
    const lineasTxt = lineas.map((l) => `• ${l.producto_nombre}: ${Number(l.cantidad)} ${l.unidad ?? "ud"}`).join("\n");
    const texto = `*Pedido ${ref} — ${empresaNombre}*\n${lineasTxt}\nTotal: ${(Number(pedido.total) || 0).toFixed(2)} €\n(Te enviamos el PDF por email.)`;
    const url = `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
    return { ok: true, url, telefono: tel || null };
  } catch (err) {
    console.error("[pedidos] prepararWhatsappPedido RAW:", JSON.stringify(err), err);
    return { ok: false, error: mensajeError(err) };
  }
}
