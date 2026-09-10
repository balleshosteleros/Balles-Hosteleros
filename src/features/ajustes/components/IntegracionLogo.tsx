"use client";

/**
 * Logo de cada integración, a tamaño uniforme para que la rejilla se vea
 * pareja. Los que tienen fichero real salen de /public/icons/apps; Google se
 * dibuja en SVG inline porque no había fichero y así se ve nítido a cualquier
 * tamaño sin añadir un binario al repo.
 */

import Image from "next/image";

/** Logo oficial de Google (la "G" de cuatro colores). */
function GoogleLogo({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/** Marca de Revolut: la "R" sobre su azul corporativo. */
function RevolutLogo({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="48" height="48" rx="10" fill="#0666EB" />
      <path
        fill="#ffffff"
        d="M14 12h12.4c4.7 0 8 2.9 8 7.3 0 3.5-2 6-5.3 7l6.2 9.7h-6.4l-5.6-9.1h-3.6V36H14V12zm5.7 4.7v5.9h6.1c2 0 3.2-1.1 3.2-2.9 0-1.9-1.2-3-3.2-3h-6.1z"
      />
    </svg>
  );
}

/** Logo de Meta: el lazo infinito, en su azul de marca. */
function MetaLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        fill="#0081FB"
        d="M9.5 30.6c0 1.7.4 3 .9 3.8.7 1.1 1.7 1.5 2.7 1.5 1.4 0 2.6-.3 5-3.6 1.9-2.6 4.1-6.3 5.6-8.6l2.5-3.9c1.8-2.7 3.8-5.7 6.2-7.7 1.9-1.7 4-2.6 6.1-2.6 3.5 0 6.9 2 9.5 5.9 2.8 4.2 4.2 9.5 4.2 15 0 3.2-.6 5.6-1.7 7.5-1.1 1.8-3.2 3.6-6.7 3.6v-5.3c3 0 3.8-2.8 3.8-6 0-4.6-1.1-9.7-3.4-13.3-1.7-2.6-3.8-4.2-6.2-4.2-2.6 0-4.6 1.9-6.9 5.4-1.2 1.8-2.5 4-3.9 6.5l-1.5 2.6c-3 5-3.7 6.2-5.2 8.2-2.6 3.4-4.8 4.7-7.7 4.7-3.5 0-5.8-1.5-7.1-3.8C.8 34.4.2 32 .2 29.2l5.3.1c0 .5 0 1 .1 1.3h3.9Z"
      />
      <path
        fill="#0064E1"
        d="M8.4 16.4c2.4-3.7 5.9-6.3 9.9-6.3 2.3 0 4.6.7 7 2.7 2.6 2.2 5.4 5.8 8.9 11.7l1.2 2.1c3 5.1 4.7 7.7 5.7 9 1.3 1.6 2.2 2.1 3.4 2.1 3 0 3.8-2.8 3.8-6l4.7-.1c0 3.2-.6 5.6-1.7 7.5-1.1 1.8-3.2 3.6-6.7 3.6-2.2 0-4.1-.5-6.3-2.5-1.7-1.6-3.6-4.4-5.1-6.9l-4.4-7.4c-2.2-3.7-4.2-6.4-5.4-7.7-1.2-1.4-2.8-3-5.4-3-2.1 0-3.8 1.4-5.3 3.6l-4.3-2.4Z"
      />
      <path
        fill="#0082FB"
        d="M18.2 15.3c-2.1 0-3.8 1.4-5.3 3.6-2.1 3.1-3.4 7.6-3.4 12l-5.3-.1c0-5 1.3-10.3 3.8-14.1 2.4-3.7 5.9-6.3 9.9-6.3l.3 4.9Z"
      />
    </svg>
  );
}

/** Sobre de Gmail: los cuatro colores de Google sobre el sobre blanco. */
function GmailLogo({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 36"
      aria-hidden="true"
      focusable="false"
    >
      <path fill="#4285F4" d="M3.3 36h6.5V19.6L0 12.3v20.4C0 34.5 1.5 36 3.3 36z" />
      <path fill="#34A853" d="M38.2 36h6.5c1.8 0 3.3-1.5 3.3-3.3V12.3l-9.8 7.3V36z" />
      <path fill="#FBBC04" d="M38.2 3.3v16.3L48 12.3V4.9c0-4-4.6-6.3-7.8-3.9l-2 1.5v.8z" />
      <path fill="#EA4335" d="M9.8 19.6V3.3L24 14l14.2-10.7v16.3L24 30.3 9.8 19.6z" />
      <path fill="#C5221F" d="M0 4.9v7.4l9.8 7.3V3.3l-2-1.5C4.6-1.4 0 .9 0 4.9z" />
    </svg>
  );
}

export type IntegracionLogoKey =
  | "google"
  | "agora"
  | "revolut"
  | "meta"
  | "gmail";

const FICHEROS: Record<string, string> = {
  agora: "/icons/apps/agora.png",
};

export function IntegracionLogo({
  logo,
  nombre,
  size = 40,
}: {
  logo: IntegracionLogoKey;
  /** Nombre de la integración, para el alt de la imagen. */
  nombre: string;
  size?: number;
}) {
  if (logo === "google") return <GoogleLogo size={size} />;
  if (logo === "revolut") return <RevolutLogo size={size} />;
  if (logo === "meta") return <MetaLogo size={size} />;
  if (logo === "gmail") return <GmailLogo size={size} />;

  const src = FICHEROS[logo];
  if (!src) return null;

  return (
    <Image
      src={src}
      alt={nombre}
      width={size}
      height={size}
      className="h-10 w-10 object-contain"
    />
  );
}
