import { NextResponse } from "next/server";
import { googleFetchAuto } from "@/lib/google/api";
import type { DriveItem } from "../listar/route";

/**
 * PRP-084 — Busca por nombre en el Drive de la cuenta conectada.
 *
 * Busca en todo lo que esa cuenta ve (Mi unidad + Compartido conmigo). Google
 * decide el alcance: si no tienen acceso, no sale.
 *
 * SOLO LECTURA.
 */

const CAMPOS =
  "files(id,name,mimeType,size,modifiedTime,iconLink,thumbnailLink,webViewLink)";
const CARPETA = "application/vnd.google-apps.folder";

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  iconLink?: string;
  thumbnailLink?: string;
  webViewLink?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const texto = (searchParams.get("q") ?? "").trim();

  if (texto.length < 2) {
    return NextResponse.json({ items: [] });
  }

  // Las comillas simples rompen la query de Drive: hay que escaparlas.
  const seguro = texto.replace(/'/g, "\\'");

  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", `name contains '${seguro}' and trashed = false`);
  url.searchParams.set("fields", CAMPOS);
  url.searchParams.set("pageSize", "50");
  url.searchParams.set("orderBy", "folder,name");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");

  const { data, needsReauth } = await googleFetchAuto<{ files?: DriveFile[] }>(
    url.toString(),
  );

  if (needsReauth) {
    return NextResponse.json({ error: "reauth" }, { status: 401 });
  }
  if (!data) {
    return NextResponse.json({ error: "drive_error" }, { status: 502 });
  }

  const items: DriveItem[] = (data.files ?? []).map((f) => ({
    id: f.id,
    nombre: f.name,
    esCarpeta: f.mimeType === CARPETA,
    mimeType: f.mimeType,
    tamano: f.size ? Number(f.size) : null,
    modificado: f.modifiedTime ?? null,
    icono: f.iconLink ?? null,
    miniatura: f.thumbnailLink ?? null,
    enlaceDrive: f.webViewLink ?? null,
    esNativoGoogle: f.mimeType.startsWith("application/vnd.google-apps."),
  }));

  return NextResponse.json({ items });
}
