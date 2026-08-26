"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Bloque, BrandingSnapshot } from "../../types";
import { BloquePublico } from "./BloquePublico";
import { BannerCookies, EnlaceConfigurarCookies } from "./BannerCookies";

export interface PaginaContexto {
  empresaId: string | null;
  paginaId: string | null;
  empresaSlug?: string | null;
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
          backgroundColor: fondo,
          color: "#f5f5f4",
        } as React.CSSProperties
      }
    >
      <NavPublica logo={logo} titulo={tituloNav} hayReservas={hayReservas} />
      <main>
        {ordenados.map((b) => (
          <BloquePublico key={b.id} bloque={b} contexto={contexto} />
        ))}
      </main>
      <PieLegal />
      <BannerCookies hrefPolitica={hrefPoliticaCookies} />
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
    <nav className="border-t border-white/10 px-4 py-5">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-white/50">
        <Link href="/" className="transition-colors hover:text-white/90">
          Inicio
        </Link>
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
    </nav>
  );
}

function NavPublica({
  logo,
  titulo,
  hayReservas,
}: {
  logo: string | null;
  titulo: string;
  hayReservas: boolean;
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
        solida ? "bg-black/85 backdrop-blur-md py-2 shadow-lg" : "bg-transparent py-4"
      }`}
    >
      <div className="mx-auto max-w-6xl px-5 flex items-center gap-3">
        {logo ? (
          // Logo ya redimensionado en el bucket: <img> directo, sin optimizador.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className={`transition-all ${solida ? "h-8" : "h-11"} w-auto`} />
        ) : (
          <span className="font-semibold tracking-wide text-sm text-white/90">{titulo}</span>
        )}
        {hayReservas ? (
          <a
            href="#reservas"
            className="ml-auto rounded-full px-5 py-2 text-sm font-semibold text-black transition-transform hover:scale-105"
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
function EstilosPublicos() {
  return (
    <style>{`
      .pw-root { scroll-behavior: smooth; }
      .pw-reveal { opacity: 0; transform: translateY(28px); transition: opacity .7s ease, transform .7s ease; }
      .pw-reveal.pw-visible { opacity: 1; transform: none; }
      @media (prefers-reduced-motion: reduce) {
        .pw-root { scroll-behavior: auto; }
        .pw-reveal { opacity: 1; transform: none; transition: none; }
      }
    `}</style>
  );
}
