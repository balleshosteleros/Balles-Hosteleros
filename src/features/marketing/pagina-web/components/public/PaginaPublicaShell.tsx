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

  const primario = branding?.color_primario ?? "#d0a000";
  const fondo = branding?.color_fondo ?? "#0b0b0c";
  const logo = branding?.logo_url ?? null;
  // Tipografía de marca. Las webs replicadas usan Montserrat (la misma que GHL);
  // el valor viejo "serif" no era una fuente real, así que caía al serif del
  // navegador y por eso no se parecían.
  const tipografia = branding?.tipografia?.trim() || "Montserrat";

  const hero = ordenados.find((b) => b.tipo === "hero");
  const tituloNav = hero?.tipo === "hero" ? hero.datos.subtitulo ?? "" : "";
  const hayReservas = ordenados.some((b) => b.tipo === "reservas" && b.visible);

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
      <NavPublica logo={logo} titulo={tituloNav} hayReservas={hayReservas} slug={contexto?.empresaSlug ?? null} />
      <main>
        {ordenados.map((b) => (
          <BloquePublico key={b.id} bloque={b} contexto={contexto} />
        ))}
      </main>
      <PieLegal />
      <BannerCookies hrefPolitica={hrefPoliticaCookies} />
      <FuenteMarca nombre={tipografia} />
      <EstilosPublicos />
    </div>
  );
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
function PieLegal() {
  return (
    <nav className="border-t border-white/10 px-4 py-8">
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
  hayReservas,
  slug,
}: {
  logo: string | null;
  titulo: string;
  hayReservas: boolean;
  /** Slug de la empresa: enlaza los portales (/carta, /empleo). */
  slug: string | null;
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
          // Logo ya redimensionado en el bucket: <img> directo, sin optimizador.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            /* Isotipo grande: el logo completo (marca + bajada) se veía
               diminuto e ilegible a la altura de una barra. */
            className={`w-auto object-contain transition-all ${solida ? "h-12" : "h-16 md:h-20"}`}
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
          {slug ? (
            <a href={`/carta/${slug}`} className="text-[13px] font-semibold uppercase tracking-wider text-white/85 transition-colors hover:text-white">
              Carta
            </a>
          ) : null}
          <a href="#mapa" className="text-[13px] font-semibold uppercase tracking-wider text-white/85 transition-colors hover:text-white">
            Ubicación
          </a>
          <a href="#contacto" className="text-[13px] font-semibold uppercase tracking-wider text-white/85 transition-colors hover:text-white">
            Contacto
          </a>
          {slug ? (
            <a
              href={`/empleo/${slug}?o=WEB`}
              className="text-[13px] font-semibold uppercase tracking-wider text-white/85 transition-colors hover:text-white"
            >
              Trabaja con nosotros
            </a>
          ) : null}
        </nav>
        {hayReservas ? (
          <a
            href="#reservas"
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
