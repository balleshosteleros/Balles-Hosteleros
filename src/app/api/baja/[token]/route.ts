/**
 * Baja de un clic, la que dispara el botón de Gmail.
 *
 * Gmail y Outlook pintan su propio "cancelar suscripción" junto al remitente
 * cuando el correo trae la cabecera `List-Unsubscribe-Post`. Ese botón NO abre
 * ninguna página: hace un POST silencioso a esta dirección y espera un 200. Sin
 * esta ruta, el botón no funcionaría —la página de baja solo responde a una
 * visita normal— y los clientes que confían en él acabarían usando el de spam.
 *
 * Es una ruta aparte de `/baja/<token>` porque en Next una misma dirección no
 * puede ser página y API a la vez. La cabecera del correo apunta aquí; el enlace
 * visible del pie sigue llevando a la página, que da explicaciones.
 *
 * El token firmado es toda la autorización: quien lo tiene, lo recibió en su
 * correo. Por eso esta ruta es pública.
 */
import { NextResponse } from "next/server";
import { darDeBaja } from "@/features/marketing/services/baja-marketing";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const r = await darDeBaja(token);

  // A Gmail se le responde 200 aunque el token no cuadre. Un error le haría
  // reintentar y, sobre todo, enseñarle al cliente que la baja "ha fallado"
  // cuando lo único que pasa es que el enlace venía cortado o ya se usó.
  return NextResponse.json({ ok: r.ok });
}

/**
 * Algún cliente de correo abre la dirección de la cabecera con un GET normal.
 * En ese caso se da de baja igual y se le enseña la página de siempre, que le
 * explica qué ha pasado y qué sigue recibiendo.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const r = await darDeBaja(token);
  // A la pantalla de SU restaurante: es la que lleva su isotipo y su color.
  const slug = r.empresaSlug || "x";
  return NextResponse.redirect(new URL(`/baja/${slug}/${token}`, req.url));
}
