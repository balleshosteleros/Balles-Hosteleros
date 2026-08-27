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
        className="relative h-[30vh] min-h-[210px] w-full overflow-hidden sm:h-[36vh] sm:min-h-[260px]"
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
                  "radial-gradient(115% 78% at 50% 20%, color-mix(in srgb, var(--carta-acento) 92%, #fff) 0%, var(--carta-primario) 40%, var(--carta-fondo) 100%)",
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
              "linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.04) 40%, rgba(0,0,0,0.30) 100%)",
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
                // Isotipo DORADO sobre disco NEGRO. Dorado a secas sobre el
                // hero —que también es dorado— volvía a desaparecer: el color
                // de marca necesita el negro detrás para leerse. El PNG es
                // negro con alfa, así que el trazo se tiñe con `mask-image`.
                <span
                  aria-hidden
                  className="mb-4 flex h-[76px] w-[76px] items-center justify-center rounded-full shadow-[0_6px_26px_rgba(0,0,0,0.5)] sm:h-[90px] sm:w-[90px]"
                  style={{
                    backgroundColor: "#0B0B0B",
                    border: "1px solid color-mix(in srgb, var(--carta-acento) 45%, transparent)",
                  }}
                >
                  <span
                    className="h-[58%] w-[58%]"
                    style={{
                      backgroundColor: "var(--carta-acento)",
                      WebkitMaskImage: `url(${marcaUrl})`,
                      maskImage: `url(${marcaUrl})`,
                      WebkitMaskRepeat: "no-repeat",
                      maskRepeat: "no-repeat",
                      WebkitMaskPosition: "center",
                      maskPosition: "center",
                      WebkitMaskSize: "contain",
                      maskSize: "contain",
                    }}
                  />
                </span>
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

      {/* Barra al hacer scroll: SOLO el nombre. Antes repetía el isotipo que ya
          preside el hero justo encima —el mismo icono dos veces en pantalla— y
          un rótulo "Carta digital" que no dice nada al comensal: ya sabe que
          está leyendo la carta, la abrió con el QR de su mesa. */}
      <div
        className="sticky top-0 z-30 transition-all"
        style={{
          backgroundColor: compact ? "var(--carta-fondo)" : "transparent",
          boxShadow: compact ? "0 1px 0 var(--carta-borde)" : "none",
          backdropFilter: compact ? "saturate(140%) blur(10px)" : "none",
          WebkitBackdropFilter: compact ? "saturate(140%) blur(10px)" : "none",
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center px-4 py-2.5 sm:px-6">
          <span
            className={`truncate text-base font-light tracking-[0.14em] transition-opacity duration-300 ${compact ? "opacity-100" : "opacity-0"}`}
            style={{ fontFamily: "var(--carta-fuente-titulos)", color: "var(--carta-texto)" }}
          >
            {empresa.nombre}
          </span>
        </div>
      </div>

    </header>
  );
}
