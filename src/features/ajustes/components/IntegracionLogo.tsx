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

export type IntegracionLogoKey = "google" | "agora" | "revolut";

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
