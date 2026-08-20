import { NextResponse } from "next/server";
import { googleFetchAuto } from "@/lib/google/api";

type GmailThreadListResponse = {
  threads?: { id: string }[];
  resultSizeEstimate?: number;
};

/**
 * Cuenta las CONVERSACIONES sin leer de la bandeja de entrada.
 *
 * Existe para que el badge de la barra no tenga que descargarse la bandeja
 * entera: `/gmail/messages` pide el detalle de cada hilo (una llamada a Google
 * por conversación, ~51 peticiones para 50 hilos), y el badge solo necesita un
 * numero. Con eso el contador tardaba varios segundos en aparecer y arrastraba
 * al resto de iconos, que esperaban en el mismo bloque.
 *
 * Aquí se pide solo el LISTADO de hilos con `is:unread` — una única llamada,
 * sin detalles. Cuenta hilos, no mensajes, para que coincida con lo que se ve
 * en la bandeja (2 hilos con 3 correos sin leer = 2, no 3).
 *
 * Se acota a la pestaña PRINCIPAL (`category:primary`). `in:inbox` a secas
 * abarca las cuatro pestañas de Gmail, así que el badge sumaba Promociones,
 * Redes sociales y Notificaciones: una cuenta con 1 correo real sin leer y 34
 * promociones pintaba "9+" y no bajaba ni recargando. El badge existe para
 * avisar de correo que hay que atender, y las promociones no lo son.
 *
 * IMPORTANTE: debe consultar lo MISMO que la bandeja del cajón
 * (`/gmail/messages`, carpeta "inbox"), o los dos números vuelven a divergir.
 *
 * `maxResults` va a 50: es el tope que muestra el badge (por encima pinta
 * "9+"), y pedir más no cambiaria lo que ve el usuario.
 */
export async function GET() {
  const params = new URLSearchParams({
    q: "in:inbox is:unread category:primary",
    maxResults: "50",
  });

  const res = await googleFetchAuto<GmailThreadListResponse>(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads?${params.toString()}`,
  );

  if (res.needsReauth) {
    return NextResponse.json(
      { connected: false, needsReauth: true, unread: 0 },
      { status: 401 },
    );
  }

  return NextResponse.json({
    connected: true,
    unread: res.data?.threads?.length ?? 0,
  });
}
