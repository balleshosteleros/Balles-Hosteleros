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
      <PieLegal redes={contexto?.redes ?? null} textoLegal={textoLegal} />
      <BotonWhatsApp url={contexto?.redes?.whatsapp ?? null} />
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
              Empleo
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
      <svg viewBox="0 0 24 24" fill="#fff" className="h-7 w-7">
        <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.86 1.21 3.06c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2z" />
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
