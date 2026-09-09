import "server-only";

/**
 * Lee una lista de reproducción o un canal de YouTube y devuelve sus vídeos.
 *
 * Sin clave de API y sin cuenta: se pide la página como la pediría un navegador
 * y se lee el `ytInitialData` que YouTube incrusta en el HTML. Vale también para
 * listas «no listadas», que son las que se usan para un curso de pago: no salen
 * en las búsquedas, pero quien tiene el enlace las abre.
 *
 * Es la parte frágil por definición —depende del HTML de YouTube—, así que
 * cuando no encuentra nada lo dice claro en vez de devolver una lista vacía
 * como si el curso no tuviera vídeos.
 */

export interface VideoYoutube {
  videoId: string;
  titulo: string;
}

const NAVEGADOR =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

/** De cualquier dirección de YouTube saca la página que hay que pedir. */
export function normalizarDireccion(url: string): string | null {
  const limpia = url.trim();
  if (!limpia) return null;

  // Un identificador de lista pegado a pelo.
  if (/^PL[A-Za-z0-9_-]{10,}$/.test(limpia)) {
    return `https://www.youtube.com/playlist?list=${limpia}`;
  }
  // Un @canal pegado a pelo.
  if (/^@[\w.-]+$/.test(limpia)) {
    return `https://www.youtube.com/${limpia}/videos`;
  }

  let parsed: URL;
  try {
    parsed = new URL(limpia);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  if (!host.endsWith("youtube.com") && host !== "youtu.be") return null;

  const lista = parsed.searchParams.get("list");
  if (lista) return `https://www.youtube.com/playlist?list=${lista}`;

  // Canal: /@nombre, /@nombre/videos, /channel/UC…
  const partes = parsed.pathname.split("/").filter(Boolean);
  if (partes[0]?.startsWith("@")) return `https://www.youtube.com/${partes[0]}/videos`;
  if (partes[0] === "channel" && partes[1]) {
    return `https://www.youtube.com/channel/${partes[1]}/videos`;
  }
  return null;
}

/**
 * Busca una clave por todo el árbol EN EL ORDEN EN QUE APARECE.
 *
 * El orden no es un detalle: es el de las lecciones del curso. Con una pila
 * (que saca el último) los vídeos salían justo del revés y el módulo quedaba
 * montado al contrario.
 */
function recorrer(objeto: unknown, clave: string): unknown[] {
  const encontrados: unknown[] = [];
  const visitar = (actual: unknown) => {
    if (Array.isArray(actual)) {
      for (const hijo of actual) visitar(hijo);
      return;
    }
    if (!actual || typeof actual !== "object") return;
    for (const [k, v] of Object.entries(actual as Record<string, unknown>)) {
      if (k === clave) encontrados.push(v);
      visitar(v);
    }
  };
  visitar(objeto);
  return encontrados;
}

/** Primer texto que aparece dentro de la ficha del vídeo: es su título. */
function primerTexto(objeto: unknown): string {
  const pila: unknown[] = [objeto];
  while (pila.length) {
    const actual = pila.shift();
    if (Array.isArray(actual)) {
      pila.push(...actual);
    } else if (actual && typeof actual === "object") {
      const registro = actual as Record<string, unknown>;
      if (typeof registro.content === "string" && registro.content.trim()) {
        return registro.content.trim();
      }
      if (typeof registro.simpleText === "string" && registro.simpleText.trim()) {
        return registro.simpleText.trim();
      }
      pila.push(...Object.values(registro));
    }
  }
  return "";
}

export async function leerVideosDeYoutube(
  url: string,
): Promise<{ ok: boolean; videos: VideoYoutube[]; error?: string }> {
  const direccion = normalizarDireccion(url);
  if (!direccion) {
    return {
      ok: false,
      videos: [],
      error: "Pega el enlace de una lista de reproducción o de un canal de YouTube.",
    };
  }

  let html: string;
  try {
    const res = await fetch(direccion, {
      headers: { "User-Agent": NAVEGADOR, "Accept-Language": "es-ES,es;q=0.9" },
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, videos: [], error: "YouTube no ha devuelto la página." };
    html = await res.text();
  } catch {
    return { ok: false, videos: [], error: "No se ha podido abrir la página de YouTube." };
  }

  // `[\s\S]` en vez del modificador `s`, que el objetivo de compilación del
  // proyecto no admite.
  const bruto = html.match(/ytInitialData\s*=\s*(\{[\s\S]*?\});<\/script>/);
  if (!bruto) return { ok: false, videos: [], error: "YouTube ha devuelto una página que no se entiende." };

  let datos: unknown;
  try {
    datos = JSON.parse(bruto[1]);
  } catch {
    return { ok: false, videos: [], error: "YouTube ha devuelto una página que no se entiende." };
  }

  const videos: VideoYoutube[] = [];
  const vistos = new Set<string>();

  // Presentación actual de YouTube (listas y canales).
  for (const ficha of recorrer(datos, "lockupViewModel")) {
    const registro = ficha as Record<string, unknown>;
    const id = registro.contentId;
    if (typeof id !== "string" || vistos.has(id)) continue;
    vistos.add(id);
    videos.push({ videoId: id, titulo: primerTexto(registro.metadata) });
  }
  // Presentación anterior, por si vuelve en alguna vista.
  for (const ficha of recorrer(datos, "playlistVideoRenderer")) {
    const registro = ficha as Record<string, unknown>;
    const id = registro.videoId;
    if (typeof id !== "string" || vistos.has(id)) continue;
    vistos.add(id);
    videos.push({ videoId: id, titulo: primerTexto(registro.title) });
  }

  if (!videos.length) {
    return {
      ok: false,
      videos: [],
      error: "Ahí no hay vídeos. Comprueba que la lista sea pública o «no listada», no privada.",
    };
  }
  return { ok: true, videos };
}
