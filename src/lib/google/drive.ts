import "server-only";

/**
 * PRP-081 — Acceso a Google Drive para el importador.
 *
 * SOLO LECTURA. El software nunca borra ni mueve nada en Drive: el vaciado lo
 * hace una persona a mano, cuando haya verificado que está todo copiado.
 *
 * Cubre lo que necesita el importador: listar unidades compartidas, recorrer
 * el árbol de una unidad y descargar cada archivo como stream (los Google Docs
 * se exportan a formato Office, porque no son ficheros de verdad).
 */

const DRIVE_API = "https://www.googleapis.com/drive/v3";

/** Campos comunes: los mínimos para inventariar y copiar. */
const CAMPOS = "id,name,mimeType,size,parents,modifiedTime,md5Checksum";

export const MIME_CARPETA = "application/vnd.google-apps.folder";

/** Un archivo o carpeta tal y como lo devuelve Drive. */
export interface DriveArchivo {
  id: string;
  nombre: string;
  mime: string;
  /** Bytes. Los Google Docs no lo traen: se estima al exportar. */
  tamano: number;
  esCarpeta: boolean;
  padreId: string | null;
  modificado: string | null;
}

/** Unidad compartida (Shared Drive). */
export interface UnidadCompartida {
  id: string;
  nombre: string;
}

/**
 * Los Google Docs/Sheets/Slides NO son archivos: viven solo en Google y no se
 * pueden descargar. Se EXPORTAN a formato Office real, que sí se guarda en R2.
 *
 * Decisión de Iván (27-ago-2026): formatos editables, no PDF. Se pierde la
 * edición online a varias manos — es el precio de salir de Google.
 */
const EXPORTACIONES: Record<string, { mime: string; ext: string }> = {
  "application/vnd.google-apps.document": {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ext: "docx",
  },
  "application/vnd.google-apps.spreadsheet": {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext: "xlsx",
  },
  "application/vnd.google-apps.presentation": {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ext: "pptx",
  },
  "application/vnd.google-apps.drawing": { mime: "image/png", ext: "png" },
};

/** ¿Es un documento nativo de Google que hay que exportar? */
export function necesitaExportacion(mime: string): boolean {
  return mime in EXPORTACIONES;
}

/**
 * Cómo queda un archivo de Drive una vez traído: su tipo real y su nombre con
 * la extensión correcta. Un Google Sheet "Auditoría" acaba siendo
 * "Auditoría.xlsx".
 */
export function formatoDestino(
  mime: string,
  nombre: string,
): { mime: string; nombre: string } {
  const exp = EXPORTACIONES[mime];
  if (!exp) return { mime, nombre };
  const yaTiene = nombre.toLowerCase().endsWith(`.${exp.ext}`);
  return { mime: exp.mime, nombre: yaTiene ? nombre : `${nombre}.${exp.ext}` };
}

/** Llama a la API de Drive con reintentos ante límite de peticiones. */
async function driveFetch(
  url: string,
  accessToken: string,
  intentos = 4,
): Promise<Response> {
  let ultimoError = "";
  for (let i = 0; i < intentos; i++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (res.ok) return res;

    // 429/5xx: Drive limita el ritmo. Se espera cada vez más y se reintenta;
    // con miles de archivos esto pasa de forma rutinaria.
    if (res.status === 429 || res.status >= 500) {
      ultimoError = `${res.status} ${res.statusText}`;
      await new Promise((r) => setTimeout(r, 2 ** i * 1000));
      continue;
    }
    throw new Error(`Drive ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  }
  throw new Error(`Drive no responde tras ${intentos} intentos (${ultimoError})`);
}

/** Unidades compartidas visibles para la cuenta conectada. */
export async function listarUnidadesCompartidas(
  accessToken: string,
): Promise<UnidadCompartida[]> {
  const salida: UnidadCompartida[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ pageSize: "100", fields: "nextPageToken,drives(id,name)" });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await driveFetch(`${DRIVE_API}/drives?${params}`, accessToken);
    const json = (await res.json()) as {
      drives?: Array<{ id: string; name: string }>;
      nextPageToken?: string;
    };
    for (const d of json.drives ?? []) salida.push({ id: d.id, nombre: d.name });
    pageToken = json.nextPageToken;
  } while (pageToken);

  return salida;
}

/**
 * TODOS los archivos y carpetas de una unidad compartida, de una sola vez.
 *
 * Drive permite pedir el contenido de una unidad entera sin ir carpeta por
 * carpeta: se traen páginas de 1000 y el árbol se reconstruye después con los
 * `parents`. Es la diferencia entre una consulta por carpeta (cientos de
 * llamadas en serie, minutos de espera) y unas pocas páginas.
 *
 * `onProgreso` permite ir informando: con muchos archivos la primera lectura
 * sigue tardando, pero al menos se ve avanzar.
 */
export async function listarUnidadCompleta(
  accessToken: string,
  unidadId: string,
  onProgreso?: (leidos: number) => void,
): Promise<DriveArchivo[]> {
  const salida: DriveArchivo[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: "trashed = false",
      pageSize: "1000",
      fields: `nextPageToken,files(${CAMPOS})`,
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      corpora: "drive",
      driveId: unidadId,
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await driveFetch(`${DRIVE_API}/files?${params}`, accessToken);
    const json = (await res.json()) as {
      files?: Array<{
        id: string;
        name: string;
        mimeType: string;
        size?: string;
        parents?: string[];
        modifiedTime?: string;
      }>;
      nextPageToken?: string;
    };

    for (const f of json.files ?? []) {
      salida.push({
        id: f.id,
        nombre: f.name,
        mime: f.mimeType,
        tamano: Number(f.size ?? 0),
        esCarpeta: f.mimeType === MIME_CARPETA,
        padreId: f.parents?.[0] ?? null,
        modificado: f.modifiedTime ?? null,
      });
    }
    onProgreso?.(salida.length);
    pageToken = json.nextPageToken;
  } while (pageToken);

  return salida;
}

/**
 * Descarga un archivo de Drive como stream.
 *
 * Se devuelve el cuerpo SIN leerlo en memoria: un vídeo de 1 GB tumbaría la
 * función si se cargara entero. El importador lo enchufa directamente a R2.
 */
export async function descargarArchivo(
  accessToken: string,
  archivoId: string,
  mime: string,
): Promise<{ body: ReadableStream<Uint8Array>; tamano: number | null }> {
  const exp = EXPORTACIONES[mime];

  const url = exp
    ? `${DRIVE_API}/files/${archivoId}/export?mimeType=${encodeURIComponent(exp.mime)}`
    : `${DRIVE_API}/files/${archivoId}?alt=media&supportsAllDrives=true`;

  const res = await driveFetch(url, accessToken);
  if (!res.body) throw new Error("Drive devolvió una respuesta vacía");

  const largo = res.headers.get("content-length");
  return {
    body: res.body as ReadableStream<Uint8Array>,
    // La exportación no informa del tamaño hasta descargarla.
    tamano: largo ? Number(largo) : null,
  };
}
