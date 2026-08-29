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

/** Una carpeta de Drive que se puede importar. */
export interface CarpetaDrive {
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

/**
 * Carpetas de primer nivel de "Mi unidad": los orígenes que se pueden importar.
 *
 * Antes miraba también en unidades compartidas, pero se deshicieron (ago-2026)
 * y cada empresa se quedó su material en su propia cuenta. Se busca solo donde
 * está de verdad.
 */
export async function listarCarpetasDeDrive(
  accessToken: string,
): Promise<CarpetaDrive[]> {
  const salida: CarpetaDrive[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `'root' in parents and mimeType = '${MIME_CARPETA}' and trashed = false`,
      pageSize: "100",
      fields: "nextPageToken,files(id,name)",
      orderBy: "name",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await driveFetch(`${DRIVE_API}/files?${params}`, accessToken);
    const json = (await res.json()) as {
      files?: Array<{ id: string; name: string }>;
      nextPageToken?: string;
    };
    for (const f of json.files ?? []) salida.push({ id: f.id, nombre: f.name });
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
/** ¿Ese id es una unidad compartida, o una carpeta normal? */
async function esDriveId(accessToken: string, id: string): Promise<boolean> {
  try {
    const res = await driveFetch(`${DRIVE_API}/drives/${id}?fields=id`, accessToken);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Recorre una carpeta y todo lo que cuelga de ella, nivel a nivel.
 *
 * Para las carpetas de "Mi unidad" no vale la consulta de unidad completa:
 * hay que preguntar por los hijos de cada carpeta. Se pregunta por tandas de
 * carpetas para no hacer una petición por cada una.
 */
async function listarCarpetaRecursiva(
  accessToken: string,
  raizId: string,
  onProgreso?: (leidos: number) => void,
): Promise<DriveArchivo[]> {
  const salida: DriveArchivo[] = [];
  const MAX_ENTRADAS = 50_000;
  let porVisitar = [raizId];

  while (porVisitar.length) {
    // La consulta admite varios padres a la vez: de 50 en 50.
    const tanda = porVisitar.splice(0, 50);
    const filtro = tanda.map((id) => `'${id}' in parents`).join(" or ");
    const siguientes: string[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        q: `(${filtro}) and trashed = false`,
        pageSize: "1000",
        fields: `nextPageToken,files(${CAMPOS})`,
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
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
        const esCarpeta = f.mimeType === MIME_CARPETA;
        salida.push({
          id: f.id,
          nombre: f.name,
          mime: f.mimeType,
          tamano: Number(f.size ?? 0),
          esCarpeta,
          padreId: f.parents?.[0] ?? null,
          modificado: f.modifiedTime ?? null,
        });
        if (esCarpeta) siguientes.push(f.id);
      }
      onProgreso?.(salida.length);
      pageToken = json.nextPageToken;

      if (salida.length >= MAX_ENTRADAS) {
        throw new Error(
          `Esta carpeta tiene más de ${MAX_ENTRADAS.toLocaleString("es-ES")} elementos: demasiados para leerla de una vez. Importa carpetas más pequeñas por separado.`,
        );
      }
    } while (pageToken);

    porVisitar = porVisitar.concat(siguientes);
  }

  return salida;
}

export async function listarUnidadCompleta(
  accessToken: string,
  unidadId: string,
  onProgreso?: (leidos: number) => void,
): Promise<DriveArchivo[]> {
  const salida: DriveArchivo[] = [];
  let pageToken: string | undefined;

  // Tope duro: una unidad enorme dejaría la pantalla colgada indefinidamente.
  // 50.000 entradas son ~50 páginas; por encima, más vale avisar que esperar.
  const MAX_ENTRADAS = 50_000;

  // ¿Es una unidad compartida o una carpeta de "Mi unidad"? En el primer caso
  // se pide la unidad entera de golpe; en el segundo hay que ir bajando
  // carpeta por carpeta, porque la API no sabe listar "todo lo que cuelga de
  // aquí" fuera de una unidad compartida.
  if (!(await esDriveId(accessToken, unidadId))) {
    return listarCarpetaRecursiva(accessToken, unidadId, onProgreso);
  }

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

    if (salida.length >= MAX_ENTRADAS) {
      throw new Error(
        `Esta unidad tiene más de ${MAX_ENTRADAS.toLocaleString("es-ES")} elementos: demasiados para leerla de una vez. Importa carpetas más pequeñas por separado.`,
      );
    }
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

  let res: Response;
  try {
    res = await driveFetch(url, accessToken);
  } catch (err) {
    // Hay archivos que Drive declara como .xlsx o .docx pero que en realidad
    // son documentos nativos suyos: al pedirlos responde "usa Export". El tipo
    // declarado miente, así que no hay forma de saberlo de antemano. Si pasa,
    // se reintenta exportando en el formato Office que le corresponde.
    const esNativoEncubierto =
      !exp && String(err).includes("Only files with binary content");
    if (!esNativoEncubierto) throw err;

    const destino = mime.includes("spreadsheet")
      ? EXPORTACIONES["application/vnd.google-apps.spreadsheet"]
      : mime.includes("presentation")
        ? EXPORTACIONES["application/vnd.google-apps.presentation"]
        : EXPORTACIONES["application/vnd.google-apps.document"];
    try {
      res = await driveFetch(
        `${DRIVE_API}/files/${archivoId}/export?mimeType=${encodeURIComponent(destino.mime)}`,
        accessToken,
      );
    } catch {
      // Si tampoco admite esa conversión, se dice en claro en vez de soltar el
      // error crudo de Google, que no ayuda a nadie.
      throw new Error(
        "Google no deja descargar ni exportar este archivo. Ábrelo en Drive y guárdalo como Office para poder traerlo.",
      );
    }
  }
  if (!res.body) throw new Error("Drive devolvió una respuesta vacía");

  const largo = res.headers.get("content-length");
  return {
    body: res.body as ReadableStream<Uint8Array>,
    // La exportación no informa del tamaño hasta descargarla.
    tamano: largo ? Number(largo) : null,
  };
}
