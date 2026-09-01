/**
 * Correo de confirmación de COMPRA de un Ticket.
 *
 * Es un correo distinto al de una reserva: aquí todavía no hay mesa ni fecha,
 * solo una compra pagada y un código. Su trabajo es que el cliente entienda
 * tres cosas sin leer dos veces: qué ha comprado, cuánto ha pagado y qué tiene
 * que hacer ahora.
 *
 * La empresa personaliza el asunto y el mensaje desde Comunicaciones
 * (tipo TICKET_COMPRA); el marco visual viene de fábrica.
 */
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { getSiteUrl } from "@/lib/site-url";
import { getReservaEmailPlantillaSeed } from "@/lib/seeds/reserva-email-plantillas";
import {
  AVISO_NO_REPLY,
  boton,
  envolverEmail,
  escapeHtml,
  fila,
  formatearImporte,
  nl2br,
  primerNombre,
  sanitizarHex,
  sustituir,
  tarjetaCodigo,
  withAlpha,
} from "@/lib/email/reservas/estilo";

/**
 * Envía el correo de compra. Idempotente: si ya se envió, no lo repite —
 * el webhook de Revolut puede llegar más de una vez.
 */
export async function enviarEmailCompraTicket(
  compraId: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();

  const { data: compra, error } = await admin
    .from("reserva_ticket_compras")
    .select(
      "id, empresa_id, codigo, comprador_nombre, comprador_email, unidades, precio_unitario, importe_total, estado, canje_hasta, email_compra_at, producto_id, cobro_modo",
    )
    .eq("id", compraId)
    .maybeSingle();

  if (error || !compra) return { ok: false, error: "Compra no encontrada" };
  if (compra.estado !== "pagada") return { ok: false, error: "Compra no pagada" };
  if (compra.email_compra_at) return { ok: true };

  const [producto, empresa, plantilla] = await Promise.all([
    admin
      .from("reserva_ticket_productos")
      .select("nombre, descripcion, modo_precio, comentarios")
      .eq("id", compra.producto_id as string)
      .maybeSingle(),
    admin
      .from("empresas")
      .select("nombre, slug, logo_url, isotipo_url, color, color_secundario")
      .eq("id", compra.empresa_id as string)
      .maybeSingle(),
    admin
      .from("reserva_email_plantillas")
      .select("activa, asunto_personalizado, mensaje_personalizado")
      .eq("empresa_id", compra.empresa_id as string)
      .eq("tipo", "TICKET_COMPRA")
      .maybeSingle(),
  ]);

  if (plantilla.data && plantilla.data.activa === false) {
    return { ok: false, error: "Plantilla desactivada" };
  }

  const seed = getReservaEmailPlantillaSeed("TICKET_COMPRA");
  const marca = {
    nombre: (empresa.data?.nombre as string) ?? "",
    logo_url: (empresa.data?.logo_url as string | null) ?? null,
    isotipo_url: (empresa.data?.isotipo_url as string | null) ?? null,
    color: (empresa.data?.color as string | null) ?? null,
    color_secundario: (empresa.data?.color_secundario as string | null) ?? null,
  };
  const primario = sanitizarHex(marca.color) ?? "#0f172a";

  const nombreProducto = (producto.data?.nombre as string) ?? "Ticket";
  const codigo = compra.codigo as string;
  const unidades = Number(compra.unidades);
  const precioUnitario = Number(compra.precio_unitario);
  const total = Number(compra.importe_total);
  const porPersona = producto.data?.modo_precio === "por_persona";
  const esGratis = compra.cobro_modo === "gratis" || total <= 0;

  const nombreCorto = primerNombre(compra.comprador_nombre as string);
  const slug = (empresa.data?.slug as string) ?? "";
  const enlaceReserva = `${getSiteUrl()}/reservar/${slug}?ticket=${encodeURIComponent(codigo)}`;

  const vars: Record<string, string> = {
    nombre: (compra.comprador_nombre as string) ?? "",
    empresa: marca.nombre,
    codigo,
    producto: nombreProducto,
    importe: `${formatearImporte(total)} €`,
    unidades: String(unidades),
  };

  const asunto = sustituir(
    (plantilla.data?.asunto_personalizado as string | null) ?? seed?.asunto_default ?? "",
    vars,
  );
  const mensajeLibre = sustituir(
    (plantilla.data?.mensaje_personalizado as string | null) ?? seed?.mensaje_default ?? "",
    vars,
  );

  // ── Desglose económico ────────────────────────────────────────────
  // Tal y como se pidió: "2 personas × 49 € = 98 € total".
  const filas: string[] = [fila("Producto", nombreProducto)];
  if (porPersona) {
    filas.push(fila("Personas", String(unidades)));
    filas.push(fila("Precio por persona", `${formatearImporte(precioUnitario)} €`));
  }

  const tarjetaImporte = esGratis
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:14px 20px 10px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              ${filas.join("\n")}
            </table>
          </td>
        </tr>
      </table>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:18px 20px;background:${withAlpha(primario, 0.04)};text-align:center;border-bottom:1px solid #e2e8f0;">
            <div style="font-size:11px;color:#64748b;letter-spacing:0.5px;text-transform:uppercase;font-weight:600;">Total pagado</div>
            <div style="margin-top:4px;font-size:34px;font-weight:700;color:${primario};line-height:1;letter-spacing:-0.5px;">${formatearImporte(total)} €</div>
            ${porPersona
              ? `<div style="margin-top:6px;font-size:12px;color:#94a3b8;">${unidades} ${unidades === 1 ? "persona" : "personas"} &times; ${formatearImporte(precioUnitario)} €</div>`
              : ""}
          </td>
        </tr>
        <tr>
          <td style="padding:14px 20px 10px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              ${filas.join("\n")}
            </table>
          </td>
        </tr>
      </table>`;

  // ── Qué hacer ahora ───────────────────────────────────────────────
  // El cliente acaba de pagar sin elegir día: hay que dejarle clarísimo que
  // todavía le falta reservar, o creerá que ya tiene mesa.
  const bloquePasos = `<div style="margin-top:14px;padding:14px 16px;background:${withAlpha(primario, 0.06)};border-radius:8px;font-size:13px;color:#334155;line-height:1.7;">
      <div style="font-weight:700;margin-bottom:6px;color:#0f172a;">Todavía te falta reservar mesa</div>
      Tu compra está confirmada, pero aún no tienes día ni hora. Cuando sepas cuándo quieres venir, entra con tu código y elige la fecha.
    </div>`;

  const caducidad = compra.canje_hasta
    ? new Date(compra.canje_hasta as string).toLocaleDateString("es-ES", {
        day: "numeric", month: "long", year: "numeric",
      })
    : null;

  const bloqueCaducidad = caducidad
    ? `<div style="margin-top:12px;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">
        Puedes reservar hasta el <strong style="color:#64748b;">${escapeHtml(caducidad)}</strong>.
      </div>`
    : "";

  const bloqueMensaje = mensajeLibre
    ? `<div style="margin-top:14px;padding:14px 16px;background:${withAlpha(primario, 0.06)};border-radius:8px;font-size:13px;color:#334155;line-height:1.6;">${nl2br(escapeHtml(mensajeLibre))}</div>`
    : "";

  const notaProducto = producto.data?.comentarios
    ? `<div style="margin-top:14px;padding:12px 14px;background:#ffffff;border-left:3px solid ${primario};border-radius:6px;">
        <div style="font-size:11px;color:#64748b;font-weight:600;letter-spacing:0.4px;text-transform:uppercase;margin-bottom:4px;">A tener en cuenta</div>
        <div style="font-size:13px;color:#334155;line-height:1.55;">${nl2br(escapeHtml(producto.data.comentarios as string))}</div>
      </div>`
    : "";

  const contenido = [
    tarjetaImporte,
    bloqueMensaje,
    tarjetaCodigo(codigo, marca.color),
    boton("Reservar mesa", enlaceReserva, marca.color),
    bloqueCaducidad,
    bloquePasos,
    notaProducto,
  ].filter(Boolean).join("\n");

  const html = envolverEmail({
    empresa: marca,
    badge: esGratis ? "Código listo" : "Compra confirmada",
    titular: nombreCorto ? `¡Gracias, ${escapeHtml(nombreCorto)}!` : "¡Gracias por tu compra!",
    subtitulo: esGratis
      ? "Ya tienes tu código para reservar"
      : "Hemos recibido tu pago correctamente",
    contenido,
    pie: "Guarda este correo: necesitas el código para reservar tu mesa.",
  });

  // ── Versión en texto plano ────────────────────────────────────────
  const texto = [
    esGratis ? "Código listo" : "Compra confirmada",
    marca.nombre,
    "",
    nombreCorto ? `¡Gracias, ${nombreCorto}!` : "¡Gracias por tu compra!",
    "",
    mensajeLibre,
    "",
    `Producto: ${nombreProducto}`,
    porPersona
      ? `${unidades} ${unidades === 1 ? "persona" : "personas"} x ${formatearImporte(precioUnitario)} € = ${formatearImporte(total)} €`
      : esGratis ? "" : `Total pagado: ${formatearImporte(total)} €`,
    "",
    `TU CÓDIGO: ${codigo}  (un solo uso)`,
    "",
    "Todavía te falta reservar mesa. Entra con tu código y elige el día:",
    enlaceReserva,
    caducidad ? `Puedes reservar hasta el ${caducidad}.` : "",
    "",
    AVISO_NO_REPLY,
  ].filter((l) => l !== "").join("\n");

  const envio = await sendEmail({
    to: compra.comprador_email as string,
    subject: asunto || `Tu compra en ${marca.nombre}`,
    html,
    text: texto,
    fromName: marca.nombre || undefined,
    empresaId: compra.empresa_id as string,
    // El marco ya trae su propia cabecera de marca.
    brandHeader: false,
  });

  if (!envio.ok) return { ok: false, error: "No se pudo enviar el correo" };

  await admin
    .from("reserva_ticket_compras")
    .update({ email_compra_at: new Date().toISOString() })
    .eq("id", compraId);

  return { ok: true };
}
