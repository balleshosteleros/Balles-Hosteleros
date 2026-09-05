"use client";

import { useEffect, useState } from "react";
import type { Bloque, BrandingSnapshot } from "../../types";
import { BloquePublico } from "./BloquePublico";
import { BannerCookies, EnlaceConfigurarCookies } from "./BannerCookies";

export interface PaginaContexto {
  empresaId: string | null;
  paginaId: string | null;
  empresaSlug?: string | null;
  /** Isotipo de la empresa: marcador del mapa. */
  logoUrl?: string | null;
  /**
   * Portal de empleo abierto. `false` esconde el enlace del menú aunque la web
   * monte la llamada a empleo: un cliente puede no captar personal por aquí, y
   * enviarle visitantes a un portal sin vacantes es una vía muerta.
   */
  empleoActivo?: boolean;
  /** Enlaces ya normalizados desde Ajustes → datos generales. */
  redes?: {
    instagram: string | null;
    facebook: string | null;
    tiktok: string | null;
    whatsapp: string | null;
  } | null;
}

interface Props {
  bloques: Bloque[];
  contexto?: PaginaContexto;
  branding?: BrandingSnapshot | null;
  /** Ruta de la política de cookies publicada, si existe. */
  hrefPoliticaCookies?: string | null;
}

/**
 * Shell público: aplica el tema de marca como variables CSS y monta la
 * navegación fija. Los bloques leen el tema con var(--pw-*), así que cada
 * empresa se ve con SUS colores sin duplicar el código de cada bloque.
 */
export function PaginaPublicaShell({
  bloques,
  contexto,
  branding,
  hrefPoliticaCookies,
}: Props) {
  const ordenados = [...bloques].sort((a, b) => a.orden - b.orden);
  // El copyright se declara en el bloque `footer` pero se pinta en el pie del
  // shell, que cierra TODAS las páginas (las legales no montan ese bloque).
  const bloqueFooter = ordenados.find((b) => b.tipo === "footer");
  const textoLegal =
    bloqueFooter?.tipo === "footer" ? bloqueFooter.datos.texto_legal ?? null : null;

  const primario = branding?.color_primario ?? "#d0a000";
  const fondo = branding?.color_fondo ?? "#0b0b0c";
  // ISOTIPO (icono sin texto), no el logotipo: el logotipo lleva dentro el
  // nombre y la bajada "restaurante & tapeo", que a la altura de una barra se
  // vuelven ilegibles. `contexto.logoUrl` ya resuelve el isotipo de la empresa
  // y cae al logo solo si no hay isotipo cargado.
  const logo = contexto?.logoUrl ?? branding?.logo_url ?? null;
  // Tipografía de marca. Las webs replicadas usan Montserrat (la misma que GHL);
  // el valor viejo "serif" no era una fuente real, así que caía al serif del
  // navegador y por eso no se parecían.
  const tipografia = branding?.tipografia?.trim() || "Montserrat";

  const hero = ordenados.find((b) => b.tipo === "hero");
  const tituloNav = hero?.tipo === "hero" ? hero.datos.subtitulo ?? "" : "";

  // ORDEN IMPORTANTE: primero se decide qué secciones sobreviven, y DESPUÉS se
  // construye el menú a partir de esas. Al revés, el menú se calculaba sobre los
  // bloques originales y anunciaba secciones que luego se caían.
  const visibleEn = (lista: Bloque[], tipo: Bloque["tipo"]) =>
    lista.some((b) => b.tipo === tipo && b.visible);

  // Sin vacantes publicadas, la llamada a empleo se cae entera: su botón lleva
  // al portal de ofertas, y ese portal estaría vacío.
  const empleoCerrado = contexto?.empleoActivo === false;
  const conEmpleoResuelto = ordenados.map((b) =>
    empleoCerrado && b.tipo === "cta" && esEnlaceEmpleo(b.datos.boton?.href)
      ? { ...b, visible: false }
      : b,
  );

  // Reservar es un PORTAL propio (/reservar/slug), como la carta y el empleo, y
  // no una sección de la home. Antes había las dos cosas: el formulario metido
  // en un trozo de la página y la página entera, así que el visitante reservaba
  // en un sitio o en otro según por dónde entrara. Los enlaces guardados en las
  // webs siguen diciendo "#reservas" (así se crearon), y se reescriben aquí en
  // vez de migrar los datos: cualquier web nueva o importada queda bien sola.
  //
  // La ruta va SIN el slug: esta web se sirve siempre en el dominio del propio
  // restaurante, y ahí `/reservar` ya identifica el local (lo resuelve el
  // rewrite de `next.config.ts`). Repetir el nombre no aportaba nada y enseñaba
  // el slug interno en una URL de cara al público.
  const conReservasResuelto = contexto?.empresaSlug
    ? conEmpleoResuelto.map((b) => reescribirReservas(b, `/reservar`))
    : conEmpleoResuelto;

  // Anclas que EXISTEN en esta web. Un botón que apunta a "#mapa" cuando el
  // cliente ha quitado el mapa deja al visitante donde estaba, sin que nada se
  // mueva: parece que la web está rota. Aquí se detecta y el botón simplemente
  // no se pinta. "#reservas" ya no está: lo de arriba lo ha convertido en un
  // enlace al portal, que existe siempre.
  const anclasVivas = new Set<string>();
  for (const [tipo, ancla] of [
    ["mapa", "#mapa"],
    ["footer", "#contacto"],
    ["historia", "#historia"],
  ] as Array<[Bloque["tipo"], string]>) {
    if (visibleEn(conReservasResuelto, tipo)) anclasVivas.add(ancla);
  }

  // #carta aparte: la sección existe solo si además tiene foto.
  if (
    conReservasResuelto.some(
      (b) => b.tipo === "collage_carta" && b.visible && (b.datos.imagenes?.length ?? 0) > 0,
    )
  ) {
    anclasVivas.add("#carta");
  }

  const bloquesLimpios = conReservasResuelto.map((b) => limpiarEnlacesRotos(b, anclasVivas));

  // El menú SALE DE LA WEB YA RESUELTA, no está cableado: cada enlace aparece
  // solo si su sección ha sobrevivido. Antes "Ubicación" o "Contacto" se
  // pintaban siempre, así que un cliente que quitara el mapa se quedaba con un
  // enlace en la barra que no llevaba a ninguna parte.
  const visible = (tipo: Bloque["tipo"]) => visibleEn(bloquesLimpios, tipo);
  // El botón de reservar de la barra es la acción principal de la web y lleva al
  // portal. Solo falta si la empresa no tiene slug todavía, que es cuando el
  // portal aún no existe.
  const hrefReservar = contexto?.empresaSlug ? `/reservar` : null;
  const nav: Array<{ href: string; label: string }> = [];
  // La carta es un portal aparte (/carta/slug); el bloque de la web solo es la
  // llamada. Sin ese bloque, el cliente no quiere enseñar carta.
  // La sección de la carta solo se pinta si tiene foto (es una imagen a sangre
  // con el texto encima). Mientras el cliente no la suba, la sección no existe
  // y el menú no debe anunciarla.
  const hayCarta =
    bloquesLimpios.some(
      (b) => b.tipo === "collage_carta" && b.visible && (b.datos.imagenes?.length ?? 0) > 0,
    ) || visible("menu");
  if (contexto?.empresaSlug && hayCarta) {
    nav.push({ href: `/carta`, label: "Carta" });
  }
  if (visible("mapa")) nav.push({ href: "#mapa", label: "Ubicación" });
  if (visible("footer")) nav.push({ href: "#contacto", label: "Contacto" });
  // Empleo: igual que la carta, es un portal propio. Solo si la llamada sigue
  // en pie tras la limpieza.
  const hayLlamadaEmpleo = bloquesLimpios.some(
    (b) => b.tipo === "cta" && b.visible && esEnlaceEmpleo(b.datos.boton?.href),
  );
  if (contexto?.empresaSlug && hayLlamadaEmpleo) {
    nav.push({ href: `/empleo?o=WEB`, label: "Empleo" });
  }

  return (
    <div
      className="pw-root min-h-screen"
      style={
        {
          "--pw-primario": primario,
          "--pw-fondo": fondo,
          "--pw-fuente": `"${tipografia}", ui-sans-serif, system-ui, sans-serif`,
          fontFamily: `"${tipografia}", ui-sans-serif, system-ui, sans-serif`,
          backgroundColor: fondo,
          color: "#f5f5f4",
        } as React.CSSProperties
      }
    >
      <NavPublica logo={logo} titulo={tituloNav} hrefReservar={hrefReservar} enlaces={nav} />
      <main>
        {bloquesLimpios.map((b) => (
          <BloquePublico key={b.id} bloque={b} contexto={contexto} />
        ))}
      </main>
      <PieLegal redes={contexto?.redes ?? null} textoLegal={textoLegal} />
      <BotonWhatsApp url={contexto?.redes?.whatsapp ?? null} />
      <BannerCookies hrefPolitica={hrefPoliticaCookies} />
      <FuenteMarca nombre={tipografia} />
      <EstilosPublicos />
    </div>
  );
}

/** ¿Este botón lleva al portal de empleo? */
function esEnlaceEmpleo(href?: string): boolean {
  if (typeof href !== "string") return false;
  // Reconoce las dos formas: la corta (`/empleo`, `/empleo?o=WEB`) y la larga
  // con slug, que es la que llevan guardada dentro las webs ya creadas.
  return href.includes("/empleo/") || href === "/empleo" || href.startsWith("/empleo?");
}

/**
 * Manda al portal de reservas todo lo que antes bajaba a la sección de la home,
 * y quita esa sección de la página.
 *
 * Había DOS sitios para reservar —el formulario incrustado en la home y el
 * portal a pantalla completa—, y el visitante caía en uno o en otro según el
 * enlace que pulsara. Ahora reservar es un solo sitio: el portal, donde el
 * formulario se ve entero y sin el ruido del resto de la web.
 *
 * Reescribe en vez de tocar los datos guardados: las webs llevan el "#reservas"
 * grabado desde que se crearon, y las plantillas y el importador siguen
 * poniéndolo. Traduciéndolo aquí, tanto las webs actuales como las que se creen
 * mañana apuntan bien sin migrar nada.
 */
function reescribirReservas(bloque: Bloque, portal: string): Bloque {
  // La sección deja de pintarse: su formulario es justo el que ya sirve el
  // portal, duplicado dentro de un trozo de la home.
  if (bloque.tipo === "reservas") return { ...bloque, visible: false };

  const destino = (href?: string) => (href === "#reservas" ? portal : href);

  if (bloque.tipo === "hero" && bloque.datos.cta?.href === "#reservas") {
    return { ...bloque, datos: { ...bloque.datos, cta: { ...bloque.datos.cta, href: portal } } };
  }
  if (bloque.tipo === "cta" && bloque.datos.boton?.href === "#reservas") {
    return { ...bloque, datos: { ...bloque.datos, boton: { ...bloque.datos.boton, href: portal } } };
  }
  if (bloque.tipo === "footer" && bloque.datos.columnas?.some((c) => c.items.some((i) => i.href === "#reservas"))) {
    return {
      ...bloque,
      datos: {
        ...bloque.datos,
        columnas: bloque.datos.columnas.map((c) => ({
          ...c,
          items: c.items.map((i) => ({ ...i, href: destino(i.href) ?? i.href })),
        })),
      },
    };
  }
  return bloque;
}

/**
 * Quita del bloque los enlaces internos que apuntan a una sección que esta web
 * no tiene. Devuelve el bloque tal cual si no hay nada que limpiar, para no
 * crear objetos nuevos en cada render sin motivo.
 *
 * Solo mira anclas internas ("#loquesea"): un enlace externo o a otro portal
 * (/carta, /empleo) no se toca, porque su destino no vive en esta página.
 */
function limpiarEnlacesRotos(bloque: Bloque, anclasVivas: Set<string>): Bloque {
  // `href === "#"` no es un enlace roto: es como el footer guarda las líneas
  // que son texto y no llevan a ninguna parte (los horarios). Tratarlas como
  // ancla muerta las borraba, y la columna "Horarios" salía vacía en la web.
  const rota = (href?: string) =>
    typeof href === "string" && href.startsWith("#") && href !== "#" && !anclasVivas.has(href);

  if (bloque.tipo === "hero" && rota(bloque.datos.cta?.href)) {
    const { cta: _descartado, ...resto } = bloque.datos;
    return { ...bloque, datos: resto };
  }
  // El botón ES la sección: sin destino (ancla muerta o href vacío) no tiene
  // sentido enseñarla. El href vacío pasa cuando la web se creó antes de que la
  // empresa tuviera slug.
  const hrefCta = bloque.tipo === "cta" ? bloque.datos.boton?.href : undefined;
  if (bloque.tipo === "cta" && (rota(hrefCta) || !hrefCta?.trim())) {
    return { ...bloque, visible: false };
  }
  if (bloque.tipo === "footer") {
    const columnas = bloque.datos.columnas?.map((c) => ({
      ...c,
      items: c.items.filter((i) => !rota(i.href)),
    }));
    const cambia = columnas?.some((c, i) => c.items.length !== bloque.datos.columnas?.[i]?.items.length);
    if (cambia) return { ...bloque, datos: { ...bloque.datos, columnas: columnas ?? [] } };
  }
  return bloque;
}

/**
 * Enlaces legales al pie de TODAS las páginas.
 *
 * Va en el shell y no en el bloque `footer` porque las páginas legales no
 * llevan ese bloque: si dependiera de él, estando en la política de privacidad
 * no habría forma de llegar al aviso legal ni de volver. Además la política
 * tiene que ser accesible desde cualquier página (RGPD) y el enlace de cookies
 * es la vía para retirar el consentimiento (AEPD).
 */
function PieLegal({ redes, textoLegal }: { redes?: PaginaContexto["redes"]; textoLegal?: string | null }) {
  return (
    <nav className="border-t border-white/10 px-4 py-8">
      {redes ? <RedesPie redes={redes} /> : null}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-white/50">
        <a href="/politica-de-privacidad" className="transition-colors hover:text-white/90">
          Política de privacidad
        </a>
        <a href="/aviso-legal" className="transition-colors hover:text-white/90">
          Aviso legal
        </a>
        <a href="/politica-de-cookies" className="transition-colors hover:text-white/90">
          Política de cookies
        </a>
        <EnlaceConfigurarCookies className="transition-colors hover:text-white/90" />
      </div>
      {/* Copyright de la empresa, justo encima de la firma del software: cierra
          la web con el nombre del restaurante y deja la marca de tecnología
          debajo, en segundo plano. */}
      {textoLegal ? (
        <p className="mt-6 text-center text-xs text-white/45">{textoLegal}</p>
      ) : null}
      {/* Firma discreta del software. Deliberadamente pequeña y sin logo: es una
          marca de tecnología, no un anuncio; la web es del restaurante. */}
      <p className="mt-5 text-center text-[11px] text-white/25">
        Tecnología por{" "}
        <a
          href="https://software.balleshosteleros.com"
          target="_blank"
          rel="noreferrer noopener"
          className="font-medium transition-colors hover:text-white/50"
        >
          Software Balles Hosteleros
        </a>
      </p>
    </nav>
  );
}

function NavPublica({
  logo,
  titulo,
  hrefReservar,
  enlaces,
}: {
  logo: string | null;
  titulo: string;
  /** Portal de reservas de esta empresa, o null si aún no tiene slug. */
  hrefReservar: string | null;
  /** Enlaces ya filtrados: solo los que tienen sección detrás. */
  enlaces: Array<{ href: string; label: string }>;
}) {
  const [solida, setSolida] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolida(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        solida
          ? "bg-black/95 py-2.5 shadow-[0_2px_20px_rgba(0,0,0,0.6)] backdrop-blur-md"
          : "bg-gradient-to-b from-black/90 via-black/60 to-transparent py-5"
      }`}
    >
      <div className="mx-auto max-w-6xl px-5 flex items-center gap-3">
        {logo ? (
          /* El isotipo es un PNG negro con transparencia: sobre la barra negra
             se perdía por completo. Se pinta con `mask-image` usando el color
             de marca, así el trazo se lee siempre sea cual sea el fondo. */
          <span
            aria-hidden
            className={`block shrink-0 transition-all ${solida ? "h-11 w-11" : "h-14 w-14 md:h-16 md:w-16"}`}
            style={{
              backgroundColor: "var(--pw-primario)",
              WebkitMaskImage: `url(${logo})`,
              maskImage: `url(${logo})`,
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              maskPosition: "center",
              WebkitMaskSize: "contain",
              maskSize: "contain",
              filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.6))",
            }}
          />
        ) : (
          <span className="font-semibold tracking-wide text-sm text-white/90">{titulo}</span>
        )}
        {/* Menú como el de GHL (Carta · Ubicación · Contacto · Trabaja con
            nosotros), pero apuntando a NUESTROS portales. Se oculta en móvil:
            ahí manda el botón de reservar, que es la acción principal. */}
        <nav
          className="ml-auto hidden items-center gap-8 md:flex"
        >
          {enlaces.map((e) => (
            <a
              key={e.href}
              href={e.href}
              className="text-[13px] font-semibold uppercase tracking-wider text-white/85 transition-colors hover:text-white"
            >
              {e.label}
            </a>
          ))}
        </nav>
        {hrefReservar ? (
          <a
            href={hrefReservar}
            className="ml-auto rounded-full px-5 py-2 text-sm font-bold uppercase tracking-wider text-black transition-transform hover:scale-105 md:ml-7"
            style={{ backgroundColor: "var(--pw-primario)" }}
          >
            Reservar
          </a>
        ) : null}
      </div>
    </header>
  );
}

/** Animación de aparición al entrar en pantalla, respetando "reducir movimiento". */
/**
 * Carga la tipografía de marca desde Google Fonts. `display=swap` para que el
 * texto se lea desde el primer momento aunque la fuente aún no haya bajado.
 */
function FuenteMarca({ nombre }: { nombre: string }) {
  const familia = encodeURIComponent(nombre.trim()).replace(/%20/g, "+");
  const href = `https://fonts.googleapis.com/css2?family=${familia}:wght@300;400;500;600;700;800&display=swap`;
  return <link rel="stylesheet" href={href} />;
}

/**
 * Las tres grandes redes al pie, con el color real de cada marca. Los enlaces
 * salen de Ajustes: cambiar Instagram allí actualiza la web sola.
 */
/**
 * Botón flotante de WhatsApp: abre la conversación con el número de la empresa
 * (Ajustes → datos generales → WhatsApp). Si no hay número configurado no se
 * pinta, en vez de dejar un botón que no lleva a ninguna parte.
 *
 * Va arriba del banner de cookies para que no se tapen entre ellos.
 */
function BotonWhatsApp({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      aria-label="Escríbenos por WhatsApp"
      title="Escríbenos por WhatsApp"
      className="fixed bottom-5 right-5 z-[55] flex h-14 w-14 items-center justify-center rounded-full shadow-[0_8px_28px_rgba(0,0,0,0.45)] transition-transform hover:scale-110"
      style={{ backgroundColor: "#25D366" }}
    >
      {/* Logo oficial de WhatsApp: el globo con la cola y el auricular CALADO
          dentro (una sola silueta con `fill-rule`), no dos piezas sueltas. */}
      <svg viewBox="0 0 32 32" fill="#fff" className="h-7 w-7" aria-hidden>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M16.004 0h-.008C7.174 0 .002 7.174.002 16c0 3.5 1.128 6.745 3.046 9.38L1.05 31.29l6.113-1.954A15.9 15.9 0 0016.004 32C24.83 32 32 24.826 32 16S24.83 0 16.004 0zm9.313 22.593c-.386 1.09-1.918 1.994-3.14 2.258-.836.178-1.928.32-5.604-1.203-4.702-1.948-7.73-6.726-7.966-7.036-.226-.31-1.9-2.53-1.9-4.826 0-2.296 1.166-3.415 1.636-3.895.386-.394 1.024-.574 1.636-.574.198 0 .376.01.536.018.47.02.706.048 1.016.79.386.93 1.326 3.226 1.438 3.462.114.236.228.556.068.866-.15.32-.282.462-.518.734-.236.272-.46.48-.696.772-.216.254-.46.526-.188.996.272.46 1.21 1.992 2.59 3.221 1.782 1.586 3.226 2.093 3.744 2.309.386.16.846.122 1.128-.178.358-.386.8-1.026 1.25-1.656.32-.452.724-.508 1.148-.348.432.15 2.718 1.28 3.188 1.514.47.236.78.348.894.546.112.198.112 1.128-.274 2.218z"
        />
      </svg>
    </a>
  );
}

function RedesPie({ redes }: { redes: NonNullable<PaginaContexto["redes"]> }) {
  const items = [
    {
      k: "instagram",
      label: "Instagram",
      url: redes.instagram,
      fondo: "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)",
      d: "M12 2.2c3.2 0 3.6 0 4.9.07 1.2.05 1.8.25 2.2.42.6.22 1 .48 1.4.9.43.42.7.82.92 1.4.17.4.37 1 .42 2.2.06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.05 1.2-.25 1.8-.42 2.2-.22.6-.5 1-.92 1.4-.42.43-.82.7-1.4.92-.4.17-1 .37-2.2.42-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.2-.05-1.8-.25-2.2-.42-.6-.22-1-.5-1.4-.92-.43-.42-.7-.82-.92-1.4-.17-.4-.37-1-.42-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.05-1.2.25-1.8.42-2.2.22-.6.5-1 .92-1.4.42-.43.82-.7 1.4-.92.4-.17 1-.37 2.2-.42C8.4 2.2 8.8 2.2 12 2.2zm0 5.4a4.4 4.4 0 100 8.8 4.4 4.4 0 000-8.8zm0 7.25a2.85 2.85 0 110-5.7 2.85 2.85 0 010 5.7zm5.6-7.42a1.03 1.03 0 11-2.05 0 1.03 1.03 0 012.05 0z",
    },
    {
      k: "facebook",
      label: "Facebook",
      url: redes.facebook,
      fondo: "#1877F2",
      d: "M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.44 2.9h-2.34V22c4.78-.79 8.44-4.93 8.44-9.94z",
    },
    {
      k: "tiktok",
      label: "TikTok",
      url: redes.tiktok,
      fondo: "#000000",
      d: "M16.6 5.82A4.28 4.28 0 0115.54 3h-3.09v12.4a2.59 2.59 0 01-2.59 2.5 2.59 2.59 0 01-2.59-2.59 2.59 2.59 0 013.19-2.51V9.66a5.7 5.7 0 00-.6-.03A5.68 5.68 0 004.18 15.3 5.68 5.68 0 009.86 21a5.68 5.68 0 005.68-5.68V9.01a7.35 7.35 0 004.3 1.38V7.3a4.29 4.29 0 01-3.24-1.48z",
    },
  ].filter((r) => Boolean(r.url));

  if (!items.length) return null;

  return (
    <div className="mb-7 flex items-center justify-center gap-4">
      {items.map((r) => (
        <a
          key={r.k}
          href={r.url as string}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={r.label}
          title={`Síguenos en ${r.label}`}
          className="flex h-11 w-11 items-center justify-center rounded-full text-white transition-transform hover:scale-110"
          style={{ background: r.fondo, border: r.k === "tiktok" ? "1px solid rgba(255,255,255,0.22)" : undefined }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-[22px] w-[22px]">
            <path d={r.d} />
          </svg>
        </a>
      ))}
    </div>
  );
}

function EstilosPublicos() {
  return (
    <style>{`
      .pw-root { scroll-behavior: smooth; }

      /* Escala tipográfica copiada de las webs de GoHighLevel que replicamos:
         55px de titular en escritorio y 28-30px en móvil. Con text-3xl/4xl de
         Tailwind (30/36px) los titulares se quedaban pequeños y la web no se
         parecía por mucho que el texto fuera el mismo. */
      .pw-h1 { font-size: 30px; line-height: 1.12; letter-spacing: -0.01em; }
      .pw-h2 { font-size: 28px; line-height: 1.18; letter-spacing: -0.01em; }
      @media (min-width: 768px) {
        .pw-h1 { font-size: 55px; }
        .pw-h2 { font-size: 45px; }
      }
      /* GHL centra el contenido en ~1080px, no en el ancho completo. */
      .pw-root section > * { margin-left: auto; margin-right: auto; }
      .pw-reveal { opacity: 0; transform: translateY(28px); transition: opacity .7s ease, transform .7s ease; }
      .pw-reveal.pw-visible { opacity: 1; transform: none; }
      @media (prefers-reduced-motion: reduce) {
        .pw-root { scroll-behavior: auto; }
        .pw-reveal { opacity: 1; transform: none; transition: none; }
      }
    `}</style>
  );
}
