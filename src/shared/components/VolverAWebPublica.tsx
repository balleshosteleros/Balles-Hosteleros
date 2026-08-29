"use client";

import { ArrowLeft, Home } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Salida de vuelta a la web del restaurante desde los portales públicos
 * (carta digital y portal de empleo).
 *
 * Estos portales son rutas propias (`/carta/[slug]`, `/empleo/[slug]`) que se
 * abren desde el menú de la web pública. Una vez dentro no había NINGÚN camino
 * de vuelta: ni cabecera con enlace ni nada, así que el cliente se quedaba
 * atrapado y tenía que cerrar la pestaña.
 *
 * La vuelta se resuelve en el navegador porque depende de CÓMO se llegó:
 *
 *  - Si venimos de la propia web (misma pestaña, mismo host), lo natural es
 *    `history.back()`: devuelve al sitio exacto del que salió, con su scroll.
 *  - Si se entró en frío (QR en la mesa, enlace compartido, buscador) no hay
 *    atrás al que volver. Entonces enlazamos a la raíz del host, que en un
 *    dominio de empresa sirve su web pública.
 *  - Si el host NO sirve web de empresa (el dominio de la app, el subdominio de
 *    los QR) la raíz es el login: ahí no se pinta nada, mejor sin salida que
 *    con una salida que echa al cliente a una pantalla de acceso.
 */
export function VolverAWebPublica({
  className = "",
  etiqueta,
}: {
  className?: string;
  /** Sólo para forzar un texto concreto; por defecto se elige según el caso. */
  etiqueta?: string;
}) {
  // `mounted` para no desincronizar servidor y cliente: el servidor no sabe ni
  // el host ni el referrer, así que en el HTML inicial esto no existe.
  const [modo, setModo] = useState<"oculto" | "atras" | "home">("oculto");

  useEffect(() => {
    const host = window.location.hostname.toLowerCase();

    // La raíz sirve una web de empresa en cualquier host que no sea la app
    // principal ni el subdominio de QR. Los dominios propios de los clientes
    // (habana.ballesosteleros.com, o su dominio real) entran por aquí.
    const esHostDeApp =
      host === "localhost" ||
      host.startsWith("127.") ||
      host.startsWith("app.") ||
      host.startsWith("sistema.") ||
      host.startsWith("qr.");

    // ¿Venimos de una página del mismo sitio? Entonces "atrás" es la web.
    let vinoDeEsteSitio = false;
    try {
      vinoDeEsteSitio =
        document.referrer !== "" && new URL(document.referrer).hostname.toLowerCase() === host;
    } catch {
      vinoDeEsteSitio = false;
    }

    if (vinoDeEsteSitio) setModo("atras");
    else if (!esHostDeApp) setModo("home");
    else setModo("oculto");
  }, []);

  if (modo === "oculto") return null;

  // El texto NO puede ser siempre "Volver": a la carta y al portal de empleo se
  // entra tambien por el QR de la mesa o por el enlace de una oferta, sin haber
  // pasado por la web. A quien llega asi, "volver" le suena a un sitio en el
  // que no ha estado. Neutro en ambos casos: "Atras" cuando de verdad hay una
  // pagina anterior, y el nombre de a donde lleva cuando no la hay.
  const texto = etiqueta ?? (modo === "atras" ? "Atrás" : "Ir a la web");

  // El icono acompana al texto: flecha cuando de verdad se retrocede, casa
  // cuando lo que hay es un salto a la web (no se "vuelve" a donde no se estuvo).
  const Icono = modo === "atras" ? ArrowLeft : Home;

  const contenido = (
    <>
      <Icono className="h-4 w-4" aria-hidden />
      <span>{texto}</span>
    </>
  );

  const clases =
    "inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/35 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-black/55 " +
    className;

  if (modo === "atras") {
    return (
      <button type="button" onClick={() => window.history.back()} className={clases}>
        {contenido}
      </button>
    );
  }

  return (
    <a href="/" className={clases}>
      {contenido}
    </a>
  );
}
