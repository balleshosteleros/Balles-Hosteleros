"use client";

import { Home } from "lucide-react";
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

  // Siempre "Ir a la web", venga uno de donde venga: es a donde lleva el botón,
  // y con "Atrás" el mismo control cambiaba de nombre según cómo se hubiera
  // entrado —QR de la mesa o menú de la web—, que es justo lo que despista.
  const texto = etiqueta ?? "Ir a la web";

  // La casa acompaña siempre al texto por el mismo motivo: el destino es el
  // mismo aunque por dentro se resuelva con `history.back()`.
  const Icono = Home;

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
