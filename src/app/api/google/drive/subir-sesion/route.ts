import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { refreshAccessToken } from "@/lib/google/api";

/**
 * Abre una sesión de subida REANUDABLE en Google Drive y devuelve su URL.
 *
 * Por qué existe: si el archivo pasa por el software, choca contra el límite
 * de cuerpo de la función en Vercel (unos 4,5 MB) y un vídeo nunca cabe. Aquí
 * el servidor solo pide permiso a Google y devuelve una URL temporal; el
 * navegador sube el archivo DIRECTAMENTE a Google, en trozos. Así no hay tope
 * práctico de tamaño: un vídeo de 1 GB o más sube igual.
 *
 * Es el mismo patrón que ya usan las grabaciones y la música contra R2.
 *
 * El token de Google NO sale al navegador: la URL que se devuelve ya lleva
 * dentro el permiso, caduca sola (una semana) y solo sirve para ESE archivo.
 *
 * SOLO CREA: no borra, no mueve, no renombra y no sobrescribe.
 */

export async function POST(request: Request) {
  let cuerpo: { nombre?: string; mime?: string; carpetaId?: string | null };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "cuerpo_invalido" }, { status: 400 });
  }

  const nombre = cuerpo.nombre?.trim();
  if (!nombre) {
    return NextResponse.json({ error: "falta_nombre" }, { status: 400 });
  }

  const c = await cookies();
  let token = c.get("g_access_token")?.value ?? null;
  const refresh = c.get("g_refresh_token")?.value ?? null;

  if (!token) {
    return NextResponse.json({ error: "reauth" }, { status: 401 });
  }

  // Sin carpeta, a la raíz de "Mi unidad".
  const metadatos = {
    name: nombre,
    ...(cuerpo.carpetaId ? { parents: [cuerpo.carpetaId] } : {}),
  };

  const pedirSesion = (t: string) =>
    fetch(
      "https://www.googleapis.com/upload/drive/v3/files" +
        "?uploadType=resumable&supportsAllDrives=true&fields=id,name",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json; charset=UTF-8",
          ...(cuerpo.mime ? { "X-Upload-Content-Type": cuerpo.mime } : {}),
        },
        body: JSON.stringify(metadatos),
      },
    );

  let res: Response;
  try {
    res = await pedirSesion(token);
  } catch (err) {
    console.error("[google] no se pudo abrir sesión de subida:", err);
    return NextResponse.json({ error: "drive_error" }, { status: 502 });
  }

  // Token caducado: se refresca una vez y se reintenta, como en el resto.
  if (res.status === 401 && refresh) {
    const nuevo = await refreshAccessToken(refresh);
    if (nuevo) {
      token = nuevo;
      try {
        res = await pedirSesion(token);
      } catch (err) {
        console.error("[google] reintento de sesión de subida:", err);
        return NextResponse.json({ error: "drive_error" }, { status: 502 });
      }
    }
  }

  if (res.status === 401 || res.status === 403) {
    // 403 con token bueno = la cuenta no concedió el permiso de escritura.
    return NextResponse.json({ error: "reauth" }, { status: 401 });
  }
  if (!res.ok) {
    console.error(
      `[google] sesión de subida → ${res.status} ${res.statusText}`,
    );
    return NextResponse.json({ error: "drive_error" }, { status: 502 });
  }

  // Google devuelve la URL de subida en la cabecera Location.
  const uploadUrl = res.headers.get("location");
  if (!uploadUrl) {
    return NextResponse.json({ error: "sin_url" }, { status: 502 });
  }

  return NextResponse.json({ uploadUrl });
}
