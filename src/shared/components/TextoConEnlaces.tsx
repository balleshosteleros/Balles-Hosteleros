import type { ReactNode } from "react";

/**
 * Texto escrito a mano en el que las direcciones se pueden PULSAR.
 *
 * El mensaje de un comunicado se escribe en un campo de texto normal, así que
 * una dirección pegada dentro salía como texto muerto: el trabajador la veía
 * pero no podía abrirla, y en el móvil ni seleccionarla entera.
 *
 * Reconoce `https://…`, `www.…` y los correos. Se admite escribir la dirección
 * a medias: al pulsar se le pone el `https://` delante. Los saltos de línea se
 * respetan con `whitespace-pre-line` en quien lo pinta.
 */
const PATRON = /((?:https?:\/\/|www\.)[^\s<]+|[^\s<@]+@[^\s<@]+\.[^\s<@.]+)/gi;

/** La coma o el punto del final de la frase no forman parte de la dirección. */
function limpiarCola(t: string): { url: string; cola: string } {
  const m = t.match(/[).,;:!?»"']+$/);
  if (!m) return { url: t, cola: "" };
  return { url: t.slice(0, t.length - m[0].length), cola: m[0] };
}

export function TextoConEnlaces({ texto }: { texto: string }): ReactNode {
  if (!texto) return null;
  const trozos = texto.split(PATRON);
  return (
    <>
      {trozos.map((t, i) => {
        if (!t) return null;
        // Los impares son las coincidencias del patrón.
        if (i % 2 === 0) return <span key={i}>{t}</span>;
        const { url, cola } = limpiarCola(t);
        const esCorreo = url.includes("@") && !/^https?:\/\//i.test(url);
        const href = esCorreo
          ? `mailto:${url}`
          : /^https?:\/\//i.test(url)
            ? url
            : `https://${url}`;
        return (
          <span key={i}>
            <a
              href={href}
              target={esCorreo ? undefined : "_blank"}
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-2 hover:opacity-80 break-all"
            >
              {url}
            </a>
            {cola}
          </span>
        );
      })}
    </>
  );
}
