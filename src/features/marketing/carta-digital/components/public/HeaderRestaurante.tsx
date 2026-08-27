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

  // Marca de la carta = ISOTIPO de imagen de marca (icono sin texto). Sólo se
  // cae al logo alternativo/principal si la empresa aún no ha subido isotipo.
  const marcaUrl = empresa.isotipo_url || empresa.logo_alt_url || empresa.logo_url || null;

  const compact = scrollY > 80;
  const heroOpacity = Math.max(0, 1 - scrollY / 320);
  const heroParallax = scrollY * 0.4;

  return (
    <header className="relative isolate">
      <div
        className="relative h-[42vh] min-h-[280px] w-full overflow-hidden sm:h-[52vh] sm:min-h-[360px]"
        style={{
          // Con imagen de cabecera el fondo solo rellena lo que sobra: en negro
          // pasa desapercibido. Sin imagen, el degradado de marca lo tapa entero.
          backgroundColor: empresa.carta_hero_url ? "#0a0a0a" : "var(--carta-primario)",
        }}
      >
        {empresa.carta_hero_url ? (
          <div
            className="absolute inset-0 transition-transform duration-100 ease-out will-change-transform"
            style={{ transform: `translateY(${heroParallax}px)`, opacity: heroOpacity }}
          >
            {/* `object-contain` y sin `scale`: estas cabeceras suelen ser el
                rótulo del negocio, y recortarlas se comía parte del nombre.
                El fondo en negro rellena lo que sobra sin bandas raras. */}
            <Image
              src={empresa.carta_hero_url}
              alt={empresa.nombre}
              fill
              priority
              sizes="100vw"
              className="object-contain"
            />
          </div>
        ) : (
          // Sin foto de cabecera —lo normal al empezar— un degradado plano deja
          // la carta con aire de plantilla sin terminar. Estas tres capas dan
          // profundidad usando SOLO el color de marca de la empresa: halo de
          // luz, viñeta que cierra los bordes y una trama fina que rompe el
          // plano de color. Funciona igual sea cual sea el color del cliente.
          <div className="absolute inset-0 transition-opacity" style={{ opacity: heroOpacity }}>
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(115% 75% at 50% 22%, color-mix(in srgb, var(--carta-acento) 92%, #fff) 0%, var(--carta-primario) 42%, #060505 100%)",
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(60% 42% at 50% 26%, rgba(255,255,255,0.30) 0%, transparent 62%)",
              }}
            />
            <div
              className="absolute inset-0 opacity-[0.16] mix-blend-overlay"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(115deg, rgba(255,255,255,.55) 0 1px, transparent 1px 7px)",
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(125% 95% at 50% 40%, transparent 42%, rgba(0,0,0,0.62) 100%)",
              }}
            />
          </div>
        )}

        <div
          className="absolute inset-0 transition-opacity"
          style={{
            opacity: heroOpacity,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.55) 100%)",
          }}
        />

        {/* Cuando hay imagen de cabecera, esa imagen SUELE llevar ya el nombre
            y el logotipo del negocio (es la que usan en redes). Repetirlos
            encima tapaba la imagen y dejaba el nombre ilegible sobre el
            propio rótulo. Con foto: la imagen habla sola y el nombre queda
            para lectores de pantalla. Sin foto: el nombre es el protagonista. */}
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          {empresa.carta_hero_url ? (
            <h1 className="sr-only">{empresa.nombre}</h1>
          ) : (
            <>
              {marcaUrl ? (
                // ISOTIPO, no logotipo: el logotipo lleva el nombre dentro y
                // se duplicaba con el <h1> justo debajo. Y va sobre un disco
                // claro sólido —no un cristal translúcido— porque un isotipo
                // dorado sobre un hero dorado desaparecía por completo.
                <div className="mb-5 flex h-[74px] w-[74px] items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_6px_28px_rgba(0,0,0,0.35)] ring-1 ring-black/5 sm:h-[88px] sm:w-[88px]">
                  <Image
                    src={marcaUrl}
                    alt=""
                    width={88}
                    height={88}
                    className="h-full w-full object-contain p-2.5"
                  />
                </div>
              ) : null}

              <h1
                className="text-4xl font-light tracking-[0.08em] text-white drop-shadow-lg sm:text-6xl"
                style={{ fontFamily: "var(--carta-fuente-titulos)", letterSpacing: "0.06em" }}
              >
                {empresa.nombre}
              </h1>
            </>
          )}

          {empresa.carta_descripcion ? (
            <p className="mt-3 max-w-xl text-sm font-light italic leading-relaxed text-white/85 drop-shadow sm:text-base">
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
            {compact && marcaUrl ? (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-black/5">
                <Image
                  src={marcaUrl}
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
