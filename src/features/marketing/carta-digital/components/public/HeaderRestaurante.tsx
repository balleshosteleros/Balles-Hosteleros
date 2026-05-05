"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { CartaEmpresaPublica } from "../../types";

export function HeaderRestaurante({ empresa }: { empresa: CartaEmpresaPublica }) {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const compact = scrollY > 80;
  const heroOpacity = Math.max(0, 1 - scrollY / 320);
  const heroParallax = scrollY * 0.4;

  return (
    <header className="relative isolate">
      <div
        className="relative h-[42vh] min-h-[280px] w-full overflow-hidden sm:h-[52vh] sm:min-h-[360px]"
        style={{
          backgroundColor: "var(--carta-primario)",
        }}
      >
        {empresa.carta_hero_url ? (
          <div
            className="absolute inset-0 transition-transform duration-100 ease-out will-change-transform"
            style={{ transform: `translateY(${heroParallax}px) scale(1.06)`, opacity: heroOpacity }}
          >
            <Image
              src={empresa.carta_hero_url}
              alt={empresa.nombre}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          </div>
        ) : (
          <div
            className="absolute inset-0 transition-opacity"
            style={{
              opacity: heroOpacity,
              background: `radial-gradient(120% 80% at 50% 30%, var(--carta-acento) 0%, var(--carta-primario) 55%, #000 100%)`,
            }}
          />
        )}

        <div
          className="absolute inset-0 transition-opacity"
          style={{
            opacity: heroOpacity,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.55) 100%)",
          }}
        />

        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          {empresa.logo_alt_url || empresa.logo_url ? (
            <div className="mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white/10 ring-1 ring-white/30 backdrop-blur sm:h-20 sm:w-20">
              <Image
                src={(empresa.logo_alt_url ?? empresa.logo_url) as string}
                alt={empresa.nombre}
                width={80}
                height={80}
                className="h-full w-full object-contain p-1.5"
              />
            </div>
          ) : null}

          <h1
            className="text-4xl font-light tracking-[0.08em] text-white drop-shadow-lg sm:text-6xl"
            style={{ fontFamily: "var(--carta-fuente-titulos)", letterSpacing: "0.06em" }}
          >
            {empresa.nombre}
          </h1>

          {empresa.carta_descripcion ? (
            <p className="mt-3 max-w-xl text-sm font-light italic leading-relaxed text-white/85 sm:text-base">
              {empresa.carta_descripcion}
            </p>
          ) : null}
        </div>
      </div>

      <div
        className={`sticky top-0 z-30 border-b transition-all ${compact ? "shadow-sm" : ""}`}
        style={{
          backgroundColor: compact ? "var(--carta-fondo)" : "transparent",
          borderColor: compact ? "var(--carta-borde)" : "transparent",
          backdropFilter: compact ? "saturate(140%) blur(10px)" : "none",
          WebkitBackdropFilter: compact ? "saturate(140%) blur(10px)" : "none",
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2.5 overflow-hidden">
            {compact && empresa.logo_url ? (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-black/5">
                <Image
                  src={empresa.logo_url}
                  alt=""
                  width={28}
                  height={28}
                  className="h-full w-full object-contain p-0.5"
                />
              </span>
            ) : null}
            <span
              className={`truncate font-light tracking-wide transition-all ${compact ? "text-base opacity-100" : "text-base opacity-0"}`}
              style={{ fontFamily: "var(--carta-fuente-titulos)", color: "var(--carta-texto)" }}
            >
              {empresa.nombre}
            </span>
          </div>

          <span
            className="hidden text-[10px] font-medium uppercase tracking-[0.3em] sm:inline"
            style={{ color: "var(--carta-texto-tenue)" }}
          >
            Carta digital
          </span>
        </div>
      </div>
    </header>
  );
}
