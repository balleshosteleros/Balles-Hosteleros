import { NextResponse } from "next/server";
import { googleFetchAuto } from "@/lib/google/api";

/**
 * PRP-084 — Lista carpetas y archivos de Google Drive EN VIVO.
 *
 * El software no guarda nada: cada petición pregunta a Drive. Lo que cambie
 * allí aparece aquí sin importar nada.
 *
 * Sin `folderId` devuelve las dos raíces que ve la cuenta conectada:
 *   - "Mi unidad"          → sus propios archivos
 *   - "Compartido conmigo" → carpetas que la empresa le comparte
 *
 * No hay "Unidades compartidas": son exclusivas de Google Workspace y aquí se
 * usa Google One.
 *
 * SOLO LECTURA. Este endpoint jamás escribe en Drive.
 */

/** Campos que pedimos a Drive. Menos campos = respuesta más rápida. */
const CAMPOS =
  "nextPageToken,files(id,name,mimeType,size,modifiedTime,iconLink,thumbnailLink,webViewLink,shortcutDetails)";

const CARPETA = "application/vnd.google-apps.folder";

export type DriveItem = {
  id: string;
  nombre: string;
  esCarpeta: boolean;
  mimeType: string;
  /** Bytes. Las carpetas y los documentos nativos de Google no tienen tamaño. */
  tamano: number | null;
  modificado: string | null;
  icono: string | null;
  miniatura: string | null;
  /** Enlace para abrir en Drive, en pestaña nueva. */
  enlaceDrive: string | null;
  /** true si es un documento nativo (Docs/Hojas/Slides): se abre, no se descarga. */
  esNativoGoogle: boolean;
};

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  iconLink?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  shortcutDetails?: { targetId?: string; targetMimeType?: string };
};

function aItem(f: DriveFile): DriveItem {
  // Un acceso directo se comporta como su destino, no como el atajo.
  const mime = f.shortcutDetails?.targetMimeType ?? f.mimeType;
  const id = f.shortcutDetails?.targetId ?? f.id;
  return {
    id,
    nombre: f.name,
    esCarpeta: mime === CARPETA,
    mimeType: mime,
    tamano: f.size ? Number(f.size) : null,
    modificado: f.modifiedTime ?? null,
    icono: f.iconLink ?? null,
    miniatura: f.thumbnailLink ?? null,
    enlaceDrive: f.webViewLink ?? null,
    esNativoGoogle: mime.startsWith("application/vnd.google-apps."),
  };
}

/** Carpetas primero y luego por nombre, como hace Drive. */
function ordenar(items: DriveItem[]): DriveItem[] {
  return items.sort((a, b) => {
    if (a.esCarpeta !== b.esCarpeta) return a.esCarpeta ? -1 : 1;
    return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folderId");
  const raiz = searchParams.get("raiz"); // "mi-unidad" | "compartido"
  const pageToken = searchParams.get("pageToken");

  // Sin destino concreto: devolvemos las dos secciones para pintar el inicio.
  if (!folderId && !raiz) {
    return NextResponse.json({
      raices: [
        { clave: "mi-unidad", nombre: "Mi unidad" },
        { clave: "compartido", nombre: "Compartido conmigo" },
      ],
    });
  }

  // `q` de Drive: qué pedimos según dónde estemos.
  let q: string;
  if (folderId) {
    q = `'${folderId}' in parents and trashed = false`;
  } else if (raiz === "compartido") {
    q = "sharedWithMe = true and trashed = false";
  } else {
    q = "'root' in parents and trashed = false";
  }

  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", q);
  url.searchParams.set("fields", CAMPOS);
  url.searchParams.set("pageSize", "200");
  url.searchParams.set("orderBy", "folder,name");
  // Incluye lo que vive en unidades compartidas por si alguna cuenta las tuviera.
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");
  if (pageToken) url.searchParams.set("pageToken", pageToken);

  const { data, needsReauth } = await googleFetchAuto<{
    files?: DriveFile[];
    nextPageToken?: string;
  }>(url.toString());

  if (needsReauth) {
    return NextResponse.json({ error: "reauth" }, { status: 401 });
  }
  if (!data) {
    return NextResponse.json({ error: "drive_error" }, { status: 502 });
  }

  return NextResponse.json({
    items: ordenar((data.files ?? []).map(aItem)),
    siguientePagina: data.nextPageToken ?? null,
  });
}
