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

  // Al PULSAR, el botón se rellena con el color de la empresa (Iván, 06-sep).
  // El color se toma de la variable de marca que cada portal ya define
  // —`--brand-primary` en empleo, `--brand` en reservas, `--carta-primario` en
  // la carta—, con la cadena de respaldo resolviéndose en el propio CSS: así el
  // componente no necesita saber en cuál de los tres está, y si un portal no
  // definiera ninguna se queda en el gris de siempre en vez de perder el color.
  //
  // Va en `:active` (mientras el dedo/ratón está encima) y no en `:focus`,
  // porque en móvil el foco se queda pegado después de volver y el botón se
  // quedaría coloreado sin que nadie lo esté pulsando.
  const colorMarca =
    "var(--brand-primary, var(--brand, var(--carta-primario, transparent)))";
  const colorTextoMarca =
    "var(--brand-text, var(--brand-fg, var(--carta-sobre-marca, #fff)))";

  const clases =
    "inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/35 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-black/55 " +
    // `active:` pinta el relleno y el texto con la marca; el `!` gana a los
    // colores que cada portal pasa por `className` (empleo y reservas los
    // aclaran para su fondo claro).
    "active:!bg-[var(--volver-marca)] active:!text-[var(--volver-marca-fg)] active:!border-[var(--volver-marca)] " +
    className;

  const estilo = {
    ["--volver-marca" as string]: colorMarca,
    ["--volver-marca-fg" as string]: colorTextoMarca,
  } as React.CSSProperties;

  if (modo === "atras") {
    return (
      <button
        type="button"
        onClick={() => window.history.back()}
        className={clases}
        style={estilo}
      >
        {contenido}
      </button>
    );
  }

  return (
    <a href="/" className={clases} style={estilo}>
      {contenido}
    </a>
  );
}
