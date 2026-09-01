/**
 * Webhook de Twilio: avisa de qué pasó con cada mensaje.
 *
 * Twilio llama aquí cada vez que un mensaje cambia de estado (salió, llegó, lo
 * leyeron, falló). Sin esto el software solo sabría que el mensaje se aceptó,
 * no que el cliente lo recibió — y esa es justo la diferencia que importa
 * cuando alguien no aparece y hay que saber si se le avisó.
 *
 * Docs: https://www.twilio.com/docs/messaging/guides/webhook-request
 */

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/features/accesos/lib/crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Estados de Twilio → los nuestros. Los que no interesan se ignoran. */
const ESTADOS: Record<string, string> = {
  sent: "ENVIADO",
  delivered: "ENTREGADO",
  read: "LEIDO",
  failed: "FALLIDO",
  undelivered: "FALLIDO",
};

/**
 * Comprueba que la llamada viene de Twilio y no de cualquiera que conozca la
 * dirección.
 *
 * Twilio firma con el token de la cuenta sobre la URL completa más los campos
 * del formulario ordenados alfabéticamente y concatenados.
 * https://www.twilio.com/docs/usage/security#validating-requests
 */
function firmaValida(
  url: string,
  campos: Record<string, string>,
  firmaRecibida: string,
  token: string,
): boolean {
  const datos =
    url +
    Object.keys(campos)
      .sort()
      .map((k) => k + campos[k])
      .join("");

  const esperada = crypto.createHmac("sha1", token).update(datos, "utf8").digest("base64");

  // Comparación en tiempo constante: comparar con === filtra información sobre
  // la firma correcta a quien mida los tiempos.
  const a = Buffer.from(esperada);
  const b = Buffer.from(firmaRecibida);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const firma = req.headers.get("x-twilio-signature");
  if (!firma) {
    return NextResponse.json({ error: "Falta la firma" }, { status: 401 });
  }

  // Twilio manda formulario, no JSON.
  const form = await req.formData();
  const campos: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v === "string") campos[k] = v;
  }

  const mensajeId = campos.MessageSid ?? campos.SmsSid;
  const estadoBruto = (campos.MessageStatus ?? campos.SmsStatus ?? "").toLowerCase();
  if (!mensajeId) {
    return NextResponse.json({ error: "Falta el identificador" }, { status: 400 });
  }

  const admin = createAdminClient();

  // El envío dice a qué empresa pertenece, y la empresa cuál es su token: sin
  // saber de quién es el mensaje no se puede verificar la firma.
  const { data: envio } = await admin
    .from("mensajeria_envios")
    .select("id, empresa_id, estado")
    .eq("proveedor_mensaje_id", mensajeId)
    .maybeSingle();

  if (!envio) {
    // Puede ser un mensaje de otro sistema o uno ya borrado. Se responde 200
    // para que Twilio no lo reintente eternamente.
    return NextResponse.json({ ok: true });
  }

  const { data: config } = await admin
    .from("empresa_mensajeria_config")
    .select("proveedor_token_cifrado")
    .eq("empresa_id", envio.empresa_id as string)
    .maybeSingle();

  const cifrado = config?.proveedor_token_cifrado as string | null | undefined;
  if (!cifrado) {
    return NextResponse.json({ error: "Sin credenciales" }, { status: 401 });
  }

  if (!firmaValida(req.url, campos, firma, decrypt(cifrado))) {
    return NextResponse.json({ error: "Firma no válida" }, { status: 401 });
  }

  const estado = ESTADOS[estadoBruto];
  if (!estado) return NextResponse.json({ ok: true });

  // Los avisos pueden llegar desordenados: uno de "enviado" después de uno de
  // "entregado" haría retroceder el estado y mentiría sobre lo que pasó.
  const ORDEN: Record<string, number> = {
    PENDIENTE: 0, ENVIADO: 1, ENTREGADO: 2, LEIDO: 3, FALLIDO: 4,
  };
  const actual = envio.estado as string;
  if ((ORDEN[estado] ?? 0) < (ORDEN[actual] ?? 0)) {
    return NextResponse.json({ ok: true });
  }

  await admin
    .from("mensajeria_envios")
    .update({
      estado,
      error_codigo: campos.ErrorCode ?? null,
      error_mensaje: campos.ErrorMessage ?? null,
      actualizado_at: new Date().toISOString(),
    })
    .eq("id", envio.id as string);

  return NextResponse.json({ ok: true });
}
