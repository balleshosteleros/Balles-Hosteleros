"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { VolverAWebPublica } from "@/shared/components/VolverAWebPublica";
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

  const heroOpacity = Math.max(0, 1 - scrollY / 320);
  const heroParallax = scrollY * 0.4;

  return (
    <header className="relative isolate">
      <div
        className="relative h-[30vh] min-h-[210px] w-full overflow-hidden sm:h-[36vh] sm:min-h-[260px]"
        style={{ backgroundColor: "var(--carta-primario)" }}
      >
        {/* Fondo de marca SIEMPRE, haya o no imagen de cabecera. Antes, con
            imagen, el fondo era negro plano: las cabeceras reales son logos
            cuadrados sobre blanco, y `object-contain` dejaba un recuadro
            blanco flotando en un mar negro. Ahora la imagen se apoya sobre el
            mismo degradado de marca que la version sin foto. */}
        <div className="absolute inset-0 transition-opacity" style={{ opacity: heroOpacity }}>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(85% 62% at 50% 30%, color-mix(in srgb, var(--carta-acento) 58%, var(--carta-fondo)) 0%, color-mix(in srgb, var(--carta-primario) 45%, var(--carta-fondo)) 45%, var(--carta-fondo) 100%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(50% 36% at 50% 30%, rgba(255,255,255,0.14) 0%, transparent 66%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.07] mix-blend-overlay"
            style={{
              backgroundImage:
                "repeating-linear-gradient(115deg, rgba(255,255,255,.55) 0 1px, transparent 1px 7px)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(110% 82% at 50% 38%, transparent 34%, rgba(0,0,0,0.78) 100%)",
            }}
          />
        </div>

        <div
          className="absolute inset-0 transition-opacity"
          style={{
            opacity: heroOpacity,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.04) 40%, rgba(0,0,0,0.30) 100%)",
          }}
        />

        {/* Salida hacia la web del restaurante: la carta es una ruta propia y
            sin esto el cliente se quedaba encerrado en ella. */}
        <div className="absolute left-4 top-4 z-20 sm:left-6 sm:top-6">
          <VolverAWebPublica />
        </div>

        {/* La imagen de cabecera que suben los clientes es su ROTULO: un logo
            cuadrado, casi siempre sobre fondo blanco. Tratarla como foto
            panoramica dejaba un recuadro blanco pegado en medio del negro.
            Va como marca centrada, con ancho acotado y esquinas redondeadas,
            para que el blanco se lea como una placa y no como un hueco. */}
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          {empresa.carta_hero_url ? (
            <>
              <h1 className="sr-only">{empresa.nombre}</h1>
              <span
                aria-hidden
                className="relative block h-[54%] w-auto max-w-[min(78vw,340px)] overflow-hidden rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.45)] transition-transform duration-100 ease-out will-change-transform"
                style={{
                  aspectRatio: "1 / 1",
                  transform: `translateY(${heroParallax * 0.35}px)`,
                  border: "1px solid color-mix(in srgb, var(--carta-acento) 40%, transparent)",
                }}
              >
                <Image
                  src={empresa.carta_hero_url}
                  alt=""
                  fill
                  priority
                  sizes="(max-width: 640px) 78vw, 340px"
                  className="object-contain"
                />
              </span>
            </>
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

      {/* Sin barra pegajosa de cabecera: su unico contenido era el nombre, que
          ya preside el hero justo encima —se leia BACANAL dos veces a la vez—.
          Quien navega la carta se orienta por la barra de CATEGORIAS, que es la
          que de verdad hace falta y ahora queda pegada al borde superior. */}
    </header>
  );
}
