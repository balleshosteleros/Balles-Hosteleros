/**
 * Avisos de Resend: qué le pasó a cada correo de campaña después de salir.
 *
 * Sin esto, la pantalla de campañas solo sabía "salió" o "falló", y las
 * columnas de Abiertos y Tasa de apertura marcaban 0 y 0% para siempre. Un 0%
 * se lee como "nadie abre nuestros correos", que es mentira y es peor que no
 * tener el dato.
 *
 * Resend avisa aquí de cinco cosas —entregado, abierto, clic, rebote y queja de
 * spam— y cada una escribe su fecha en la fila del envío. De ahí salen las
 * estadísticas de la campaña y la línea de Comunicaciones de la ficha del
 * cliente.
 *
 * ── Seguridad ─────────────────────────────────────────────────────────────
 * Esta dirección es pública: cualquiera puede llamarla. Se comprueba la firma
 * (Svix, la que usa Resend) antes de escribir nada, y se rechaza un aviso con
 * más de cinco minutos porque un aviso legítimo llega en segundos y uno viejo
 * es un aviso capturado y reenviado.
 *
 * ── Por qué siempre responde 200 ──────────────────────────────────────────
 * Salvo firma inválida. Un aviso de un correo que no reconocemos —uno
 * transaccional, o de antes de que existiera esta tabla— no es un error: si
 * devolviéramos un fallo, Resend lo reintentaría durante horas y acabaría
 * desactivando el aviso entero.
 *
 * ENV: `RESEND_WEBHOOK_SECRET`, el secreto `whsec_…` que da Resend al crear el
 * aviso en su panel.
 */
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Tolerancia del reloj. Un aviso legítimo llega en segundos. */
const VENTANA_SEGUNDOS = 5 * 60;

/** Qué fecha escribe cada tipo de aviso. */
const CAMPO_POR_EVENTO: Record<string, "entregado_en" | "abierto_en" | "clic_en" | "rebotado_en" | "queja_en"> = {
  "email.delivered": "entregado_en",
  "email.opened": "abierto_en",
  "email.clicked": "clic_en",
  "email.bounced": "rebotado_en",
  "email.complained": "queja_en",
};

interface AvisoResend {
  type?: string;
  created_at?: string;
  data?: { email_id?: string; to?: string[] };
}

/**
 * Comprueba la firma de Svix.
 *
 * El secreto viene en base64 detrás de `whsec_`, y se firma la cadena
 * `id.timestamp.cuerpo` con HMAC-SHA256. La cabecera puede traer varias firmas
 * separadas por espacios (Resend rota secretos sin cortar el servicio), así que
 * vale que cuadre cualquiera.
 */
function firmaValida(
  secreto: string,
  id: string,
  timestamp: string,
  cuerpo: string,
  cabecera: string,
): boolean {
  const clave = Buffer.from(secreto.replace(/^whsec_/, ""), "base64");
  const esperada = createHmac("sha256", clave)
    .update(`${id}.${timestamp}.${cuerpo}`)
    .digest("base64");

  return cabecera.split(" ").some((parte) => {
    // Cada firma viene como "v1,<base64>".
    const valor = parte.includes(",") ? parte.split(",")[1] : parte;
    if (!valor) return false;
    const a = Buffer.from(valor);
    const b = Buffer.from(esperada);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export async function POST(req: Request) {
  const secreto = process.env.RESEND_WEBHOOK_SECRET;
  if (!secreto) {
    console.error("[resend][webhook] falta RESEND_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Webhook no configurado" }, { status: 503 });
  }

  // El cuerpo CRUDO es imprescindible: la firma se calcula sobre el texto tal
  // cual llegó. Parsearlo y volver a serializarlo la invalida.
  const cuerpo = await req.text();
  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const firma = req.headers.get("svix-signature");

  if (!id || !timestamp || !firma) {
    return NextResponse.json({ error: "Faltan cabeceras de firma" }, { status: 401 });
  }
  const edad = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(edad) || edad > VENTANA_SEGUNDOS) {
    return NextResponse.json({ error: "Aviso caducado" }, { status: 401 });
  }
  if (!firmaValida(secreto, id, timestamp, cuerpo, firma)) {
    return NextResponse.json({ error: "Firma no válida" }, { status: 401 });
  }

  let aviso: AvisoResend;
  try {
    aviso = JSON.parse(cuerpo) as AvisoResend;
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const campo = CAMPO_POR_EVENTO[aviso.type ?? ""];
  const emailId = aviso.data?.email_id;
  // Un aviso de un tipo que no medimos, o de un correo transaccional que no
  // está en esta tabla: se acepta y se ignora.
  if (!campo || !emailId) return NextResponse.json({ ok: true });

  const admin = createAdminClient();
  const { data: envio } = await admin
    .from("campanas_envios")
    .select(`id, ${campo}`)
    .eq("proveedor_id", emailId)
    .maybeSingle();

  if (!envio) return NextResponse.json({ ok: true });

  // No se sobreescribe: de una apertura interesa la PRIMERA vez que lo leyó,
  // no la última. Gmail y Outlook avisan varias veces del mismo correo.
  if ((envio as Record<string, unknown>)[campo]) {
    return NextResponse.json({ ok: true });
  }

  const cuando = aviso.created_at ?? new Date().toISOString();
  await admin
    .from("campanas_envios")
    .update({ [campo]: cuando })
    .eq("id", envio.id as string);

  return NextResponse.json({ ok: true });
}
