import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { refreshAccessToken } from "@/lib/google/api";

/**
 * PRP-084 — Previsualiza o descarga un archivo de Drive.
 *
 * Hace de puente: el navegador pide el archivo al software y el software se lo
 * pide a Drive con el token del usuario. Así el token nunca sale al cliente.
 *
 * Google decide si puede o no: si esa cuenta no tiene acceso al archivo,
 * Drive responde 404/403 y aquí se devuelve tal cual.
 *
 * SOLO LECTURA — únicamente descarga (`alt=media`), nunca escribe.
 */

/** Docs, Hojas y Slides no se descargan tal cual: hay que exportarlos. */
const EXPORTAR: Record<string, { mime: string; ext: string }> = {
  "application/vnd.google-apps.document": {
    mime: "application/pdf",
    ext: "pdf",
  },
  "application/vnd.google-apps.spreadsheet": {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext: "xlsx",
  },
  "application/vnd.google-apps.presentation": {
    mime: "application/pdf",
    ext: "pdf",
  },
  "application/vnd.google-apps.drawing": {
    mime: "application/pdf",
    ext: "pdf",
  },
};

type Meta = { name: string; mimeType: string };

async function pedirADrive(url: string, token: string) {
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const descargar = searchParams.get("descargar") === "1";

  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const c = await cookies();
  let token = c.get("g_access_token")?.value ?? null;
  const refresh = c.get("g_refresh_token")?.value ?? null;

  if (!token) {
    return NextResponse.json({ error: "reauth" }, { status: 401 });
  }

  // 1) Metadatos: nos hace falta el nombre y el tipo antes de bajar nada.
  const urlMeta =
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}` +
    `?fields=name,mimeType&supportsAllDrives=true`;

  let resMeta = await pedirADrive(urlMeta, token);

  // Token caducado: lo refrescamos una vez y reintentamos.
  if (resMeta.status === 401 && refresh) {
    const nuevo = await refreshAccessToken(refresh);
    if (nuevo) {
      token = nuevo;
      resMeta = await pedirADrive(urlMeta, token);
    }
  }

  if (resMeta.status === 401) {
    return NextResponse.json({ error: "reauth" }, { status: 401 });
  }
  if (resMeta.status === 403 || resMeta.status === 404) {
    // La cuenta conectada no tiene acceso a este archivo en Drive.
    return NextResponse.json({ error: "sin_acceso" }, { status: 404 });
  }
  if (!resMeta.ok) {
    return NextResponse.json({ error: "drive_error" }, { status: 502 });
  }

  const meta = (await resMeta.json()) as Meta;
  const exportar = EXPORTAR[meta.mimeType];

  // 2) El contenido. Nativos de Google se exportan; el resto se baja tal cual.
  const urlDatos = exportar
    ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}/export` +
      `?mimeType=${encodeURIComponent(exportar.mime)}`
    : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}` +
      `?alt=media&supportsAllDrives=true`;

  const resDatos = await pedirADrive(urlDatos, token);

  if (!resDatos.ok || !resDatos.body) {
    return NextResponse.json({ error: "drive_error" }, { status: 502 });
  }

  const nombre = exportar ? `${meta.name}.${exportar.ext}` : meta.name;
  const tipo =
    exportar?.mime ??
    resDatos.headers.get("content-type") ??
    "application/octet-stream";

  const headers = new Headers({
    "Content-Type": tipo,
    "Cache-Control": "private, max-age=300",
    // `filename*` para que las tildes y las eñes no se rompan.
    "Content-Disposition":
      `${descargar ? "attachment" : "inline"}; ` +
      `filename*=UTF-8''${encodeURIComponent(nombre)}`,
  });

  const largo = resDatos.headers.get("content-length");
  if (largo) headers.set("Content-Length", largo);

  // Se devuelve en streaming: un vídeo de 2 GB no se carga en memoria.
  return new Response(resDatos.body, { status: 200, headers });
}
