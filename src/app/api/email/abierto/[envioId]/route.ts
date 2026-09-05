/**
 * Píxel de seguimiento: marca un correo como abierto.
 *
 * El correo lleva una imagen de 1x1 transparente apuntando aquí. Cuando el
 * cliente lo abre, su lector pide la imagen y esta ruta anota la apertura.
 * Devuelve SIEMPRE el GIF, pase lo que pase: si fallara, el cliente vería un
 * icono de imagen rota en mitad de su confirmación.
 *
 * LÍMITES (por eso la ficha dice "Abierto" y no promete más):
 *   · Gmail y Apple Mail precargan las imágenes al recibir el correo, así que
 *     pueden marcar abierto sin que nadie lo lea.
 *   · Outlook y quien bloquee imágenes leen sin que conste.
 * Sirve sobre todo para confirmar que el correo LLEGÓ a un buzón real.
 *
 * Es público a propósito: lo llama el lector de correo del cliente, que no
 * tiene sesión. El id del envío es un UUID, no enumerable, y lo único que se
 * puede hacer con él es marcar como abierto algo que ya se envió.
 */
import { createAdminClient } from "@/lib/supabase/admin";

// GIF transparente de 1x1 — el más pequeño que existe (43 bytes).
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

function responderPixel(): Response {
  return new Response(new Uint8Array(PIXEL), {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.length),
      // Sin caché: si el lector la guardara, la segunda apertura no llegaría.
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ envioId: string }> },
) {
  try {
    const { envioId } = await params;
    // Un id que no es UUID no llega a tocar la BD.
    if (!/^[0-9a-f-]{36}$/i.test(envioId)) return responderPixel();

    const admin = createAdminClient();
    // `abierto_at` guarda la PRIMERA apertura y no se machaca; `aperturas`
    // cuenta todas. La suma va en SQL (no leer-modificar-escribir) para que
    // dos aperturas a la vez no se pisen y se pierda una.
    await admin.rpc("registrar_apertura_email_reserva", { p_envio_id: envioId });
  } catch (e) {
    // Nunca romper la imagen por un fallo nuestro: el cliente está leyendo su
    // correo y lo único que notaría es un hueco donde no debería haber nada.
    console.error("[email][abierto] no se pudo registrar la apertura:", e);
  }
  return responderPixel();
}
