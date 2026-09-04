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
          {/* SIEMPRE el isotipo, nunca el logotipo ni la imagen de cabecera:
              el logotipo lleva el nombre dentro y se duplicaba con el título,
              y la imagen de cabecera cambiaba la carta de una empresa a otra.
              Va grande y con halo difuminado detrás —no sobre un disco negro,
              que recortaba la marca en un círculo ajeno a ella—. El nombre
              queda para lectores de pantalla: la marca ya se reconoce sola. */}
          <h1 className="sr-only">{empresa.nombre}</h1>

          {marcaUrl ? (
            <span aria-hidden className="relative flex items-center justify-center">
              {/* Halo: separa el isotipo del fondo sin encerrarlo en una forma.
                  Va poco difuminado y tirando a blanco —no al color de marca a
                  secas— porque un halo del mismo tono que el isotipo lo diluía
                  en vez de recortarlo. El blanco da el contraste; el acento,
                  solo el matiz. */}
              <span
                className="pointer-events-none absolute h-[210px] w-[210px] rounded-full blur-[22px] sm:h-[270px] sm:w-[270px]"
                style={{
                  background:
                    "radial-gradient(circle, rgba(255,255,255,0.55) 0%, color-mix(in srgb, var(--carta-acento) 45%, transparent) 42%, transparent 72%)",
                  opacity: 0.85,
                }}
              />
              {/* El PNG es negro con alfa: se tiñe del color de marca. */}
              <span
                className="relative h-[132px] w-[132px] sm:h-[168px] sm:w-[168px]"
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
                  filter: "drop-shadow(0 6px 22px rgba(0,0,0,0.55))",
                }}
              />
            </span>
          ) : (
            <h1
              className="text-4xl font-light tracking-[0.08em] text-white drop-shadow-lg sm:text-6xl"
              style={{ fontFamily: "var(--carta-fuente-titulos)", letterSpacing: "0.06em" }}
            >
              {empresa.nombre}
            </h1>
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
