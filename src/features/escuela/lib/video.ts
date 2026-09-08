/**
 * Vídeo de una lección: de la dirección que se pega en el editor a lo que hay
 * que pintar.
 *
 * Los vídeos de la escuela están HOY en YouTube y se ven DESDE YouTube: no se
 * descargan ni se suben a R2, para no gastar almacenamiento nuestro. Por eso
 * aquí solo se traduce la dirección a la de incrustar; el vídeo nunca pasa por
 * nuestro servidor.
 *
 * Se admiten las cinco formas en las que YouTube reparte un mismo vídeo
 * (`watch?v=`, `youtu.be`, `embed`, `live`, `shorts`) porque en el editor se
 * pega la que da el navegador, que cambia según de dónde se copie.
 */

export type TipoVideo = "youtube" | "vimeo" | "archivo" | "ninguno";

export interface VideoIncrustado {
  tipo: TipoVideo;
  /** Dirección lista para el `<iframe>` (YouTube/Vimeo) o para el `<video>`. */
  src: string;
  /** Miniatura que da la propia plataforma, si la hay. */
  miniatura?: string;
}

const VACIO: VideoIncrustado = { tipo: "ninguno", src: "" };

function idYoutube(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be") return url.pathname.slice(1).split("/")[0] || null;
  if (!host.endsWith("youtube.com") && !host.endsWith("youtube-nocookie.com")) return null;

  const v = url.searchParams.get("v");
  if (v) return v;

  const partes = url.pathname.split("/").filter(Boolean);
  // /embed/<id>, /live/<id>, /shorts/<id>, /v/<id>
  if (partes.length >= 2 && ["embed", "live", "shorts", "v"].includes(partes[0])) {
    return partes[1];
  }
  return null;
}

export function analizarVideo(url?: string | null): VideoIncrustado {
  const limpia = (url ?? "").trim();
  if (!limpia) return VACIO;

  let parsed: URL;
  try {
    parsed = new URL(limpia);
  } catch {
    // Una dirección relativa a nuestro propio almacenamiento sigue siendo un
    // archivo reproducible; lo que no vale es tratarla como incrustada.
    return limpia.startsWith("/") ? { tipo: "archivo", src: limpia } : VACIO;
  }

  const idYt = idYoutube(parsed);
  if (idYt) {
    // `rel=0` evita que al terminar YouTube ofrezca vídeos de otros canales
    // dentro de nuestro portal.
    return {
      tipo: "youtube",
      src: `https://www.youtube-nocookie.com/embed/${idYt}?rel=0&modestbranding=1`,
      miniatura: `https://i.ytimg.com/vi/${idYt}/hqdefault.jpg`,
    };
  }

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  if (host.endsWith("vimeo.com")) {
    const id = parsed.pathname.split("/").filter(Boolean)[0];
    if (id && /^\d+$/.test(id)) {
      return { tipo: "vimeo", src: `https://player.vimeo.com/video/${id}` };
    }
  }

  return { tipo: "archivo", src: limpia };
}

/** ¿La dirección se puede reproducir? Para avisar en el editor. */
export function videoValido(url?: string | null): boolean {
  return analizarVideo(url).tipo !== "ninguno";
}
