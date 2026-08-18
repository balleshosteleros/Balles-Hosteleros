"use client";

import Image from "next/image";
import { Heart, Star } from "lucide-react";
import type { CartaItem } from "../../types";
import { AlergenoIcon } from "./FiltroAlergenos";

/**
 * Ficha de plato.
 *
 * DOS FORMATOS, NO UNO:
 * Casi ninguna carta nace con fotos —hacerlas cuesta tiempo y dinero— y un
 * hueco gris con un cubierto dibujado ocupa un tercio de la fila para no decir
 * nada: la carta parece incompleta desde el primer día.
 *
 *  - Sin foto → formato editorial de carta impresa: nombre, línea de puntos
 *    guiando al precio, y descripción debajo. Es el lenguaje que un comensal
 *    reconoce, y se sostiene solo.
 *  - Con foto → la imagen manda, porque una foto buena vende el plato.
 *
 * Así la carta se ve terminada sin fotos, y mejora sola a medida que entran.
 */
export function ItemCard({
  item,
  likes,
  liked,
  estiloCards,
  onOpen,
}: {
  item: CartaItem;
  likes: number;
  liked: boolean;
  estiloCards: "plana" | "sombra" | "borde";
  onOpen: () => void;
}) {
  const conFoto = !!item.foto_url;
  const precio = `${item.precio.toFixed(2).replace(".", ",")}€`;

  const alergenos =
    item.alergenos.length > 0 ? (
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {item.alergenos.slice(0, 6).map((a) => (
          <span
            key={a}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full"
            style={{
              backgroundColor: "color-mix(in srgb, var(--carta-acento) 18%, transparent)",
              color: "var(--carta-primario)",
            }}
            title={a}
          >
            <AlergenoIcon alergeno={a} className="h-2.5 w-2.5" />
          </span>
        ))}
        {item.alergenos.length > 6 ? (
          <span className="text-[10px]" style={{ color: "var(--carta-texto-tenue)" }}>
            +{item.alergenos.length - 6}
          </span>
        ) : null}
      </div>
    ) : null;

  const contadorLikes =
    likes > 0 || liked ? (
      <span className="inline-flex items-center gap-1">
        <Heart
          className={`h-3 w-3 ${liked ? "fill-current" : ""}`}
          strokeWidth={1.75}
          style={{ color: liked ? "var(--carta-primario)" : "var(--carta-texto-tenue)" }}
        />
        <span
          className="text-[10px] font-medium tabular-nums"
          style={{ color: "var(--carta-texto-tenue)" }}
        >
          {likes}
        </span>
      </span>
    ) : null;

  const estrella = item.destacado ? (
    <Star
      className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500 drop-shadow-[0_1px_1.5px_rgba(146,64,14,0.45)]"
      strokeWidth={1.5}
      aria-label="Plato destacado"
    />
  ) : null;

  // ── Sin foto: formato de carta impresa ────────────────────────────
  if (!conFoto) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="group relative w-full rounded-xl px-3 py-3.5 text-left transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--carta-acento)_9%,transparent)] active:scale-[0.995]"
      >
        {/* Nombre · guía de puntos · precio. La guía es lo que hace que el ojo
            llegue del plato a su precio sin perderse, como en la carta de papel. */}
        <div className="flex items-baseline gap-2">
          <span className="flex min-w-0 items-baseline gap-1.5">
            {estrella}
            <h3
              className="truncate text-[15.5px] font-medium leading-snug sm:text-[17px]"
              style={{ color: "var(--carta-texto)", fontFamily: "var(--carta-fuente-titulos)" }}
            >
              {item.nombre}
            </h3>
          </span>

          <span
            aria-hidden
            className="mx-1 hidden h-[1px] flex-1 translate-y-[-3px] sm:block"
            style={{
              backgroundImage:
                "radial-gradient(circle, color-mix(in srgb, var(--carta-texto-tenue) 55%, transparent) 1px, transparent 1px)",
              backgroundSize: "6px 1px",
              backgroundRepeat: "repeat-x",
            }}
          />

          <span
            className="ml-auto shrink-0 whitespace-nowrap text-[15px] font-semibold tabular-nums sm:ml-0 sm:text-[16.5px]"
            style={{ color: "var(--carta-primario)", fontFamily: "var(--carta-fuente-titulos)" }}
          >
            {precio}
          </span>
        </div>

        {item.descripcion ? (
          <p
            className="mt-1 max-w-[62ch] text-[13px] font-light italic leading-relaxed sm:text-[13.5px]"
            style={{ color: "var(--carta-texto-suave)" }}
          >
            {item.descripcion}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          {alergenos ?? <span />}
          {contadorLikes ? <span className="mt-2">{contadorLikes}</span> : null}
        </div>
      </button>
    );
  }

  // ── Con foto: la imagen manda ─────────────────────────────────────
  const cardClass =
    estiloCards === "sombra"
      ? "shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.10)]"
      : estiloCards === "borde"
        ? "border"
        : "";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative flex w-full items-stretch gap-4 overflow-hidden rounded-2xl p-3 text-left transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.99] ${cardClass}`}
      style={{
        backgroundColor: "var(--carta-superficie)",
        borderColor: estiloCards === "borde" ? "var(--carta-borde)" : undefined,
      }}
    >
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl sm:h-32 sm:w-32">
        <Image
          src={item.foto_url as string}
          alt={item.nombre}
          fill
          sizes="(max-width: 640px) 96px, 128px"
          className="object-cover transition-transform duration-700 group-hover:scale-110"
        />
        {item.destacado ? (
          <span
            className="absolute left-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-[0_2px_6px_rgba(180,83,9,0.45)] ring-1 ring-amber-200/80 backdrop-blur"
            title="Plato destacado"
          >
            <Star
              className="h-4 w-4 fill-amber-400 text-amber-500 drop-shadow-[0_1px_1.5px_rgba(146,64,14,0.6)]"
              strokeWidth={1.5}
            />
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <h3
            className="text-[15.5px] font-medium leading-snug sm:text-[17px]"
            style={{ color: "var(--carta-texto)", fontFamily: "var(--carta-fuente-titulos)" }}
          >
            {item.nombre}
          </h3>
          <span
            className="shrink-0 whitespace-nowrap text-[15px] font-semibold tabular-nums sm:text-[16.5px]"
            style={{ color: "var(--carta-primario)", fontFamily: "var(--carta-fuente-titulos)" }}
          >
            {precio}
          </span>
        </div>

        {item.descripcion ? (
          <p
            className="mt-1.5 line-clamp-2 text-[13px] font-light italic leading-relaxed sm:text-[13.5px]"
            style={{ color: "var(--carta-texto-suave)" }}
          >
            {item.descripcion}
          </p>
        ) : null}

        {alergenos}
        {contadorLikes ? <div className="mt-auto pt-2">{contadorLikes}</div> : null}
      </div>
    </button>
  );
}
