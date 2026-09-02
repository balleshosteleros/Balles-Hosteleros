import { NextResponse } from "next/server";
import { getGoogleTokens, refreshAccessToken } from "@/lib/google/api";

/**
 * Descarga un adjunto de Gmail y lo devuelve como fichero.
 *
 * Gmail no da URL pública del adjunto: hay que pedir sus bytes con el token del
 * usuario (`messages/{id}/attachments/{attachmentId}`), que llegan en base64url.
 * Esta ruta hace de puente para que el navegador pueda abrirlo o descargarlo
 * como cualquier otro archivo, y para pintar las imágenes incrustadas (cid:).
 */

type AttachmentBody = { data?: string; size?: number };

function nombreSeguro(nombre: string): string {
  return nombre.replace(/[\r\n"\\]/g, "_").slice(0, 200) || "adjunto";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const messageId = url.searchParams.get("messageId");
  const attachmentId = url.searchParams.get("attachmentId");
  const nombre = url.searchParams.get("nombre") ?? "adjunto";
  const mimeType = url.searchParams.get("mimeType") ?? "application/octet-stream";
  // ?descargar=1 fuerza "Guardar como"; sin él se abre en el navegador.
  const descargar = url.searchParams.get("descargar") === "1";

  if (!messageId || !attachmentId) {
    return NextResponse.json(
      { error: "Faltan messageId o attachmentId" },
      { status: 400 },
    );
  }

  const { accessToken, refreshToken } = await getGoogleTokens();
  if (!accessToken) {
    return NextResponse.json({ error: "Sin conexión con Google" }, { status: 401 });
  }

  const endpoint = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(
    messageId,
  )}/attachments/${encodeURIComponent(attachmentId)}`;

  const pedir = (token: string) =>
    fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });

  let res = await pedir(accessToken);
  if (res.status === 401 && refreshToken) {
    const nuevo = await refreshAccessToken(refreshToken);
    if (!nuevo) {
      return NextResponse.json({ error: "Sesión de Google caducada" }, { status: 401 });
    }
    res = await pedir(nuevo);
  }

  if (!res.ok) {
    console.error(`[gmail] adjunto → ${res.status} ${res.statusText}`);
    return NextResponse.json(
      { error: "No se pudo descargar el adjunto" },
      { status: 502 },
    );
  }

  const body = (await res.json()) as AttachmentBody;
  if (!body.data) {
    return NextResponse.json({ error: "Adjunto vacío" }, { status: 404 });
  }

  // Gmail devuelve base64url (- y _ en vez de + y /).
  const bytes = Buffer.from(body.data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const seguro = nombreSeguro(nombre);

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${descargar ? "attachment" : "inline"}; filename="${seguro}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
