"use client";

import Image from "next/image";
import { Heart, Star, Utensils } from "lucide-react";
import type { CartaItem } from "../../types";
import { AlergenoIcon } from "./FiltroAlergenos";

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

  const cardClass =
    estiloCards === "sombra"
      ? "shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
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
      {/* Foto / placeholder */}
      <div
        className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl sm:h-32 sm:w-32"
        style={{ backgroundColor: "var(--carta-superficie-enfasis)" }}
      >
        {conFoto ? (
          <Image
            src={item.foto_url as string}
            alt={item.nombre}
            fill
            sizes="(max-width: 640px) 96px, 128px"
            className="object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              background: "linear-gradient(135deg, color-mix(in srgb, var(--carta-acento) 25%, var(--carta-superficie-enfasis)) 0%, var(--carta-superficie-enfasis) 100%)",
            }}
          >
            <Utensils className="h-7 w-7 opacity-30" strokeWidth={1.25} style={{ color: "var(--carta-primario)" }} />
          </div>
        )}

        {item.destacado ? (
          <span
            className="absolute left-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full backdrop-blur"
            style={{
              backgroundColor: "color-mix(in srgb, var(--carta-acento) 90%, transparent)",
              color: "var(--carta-sobre-marca)",
            }}
            title="Destacado"
          >
            <Star className="h-3 w-3 fill-current" strokeWidth={1.5} />
          </span>
        ) : null}
      </div>

      {/* Texto */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <h3
            className="text-[15px] font-semibold uppercase leading-tight tracking-[0.04em] sm:text-[16px]"
            style={{ color: "var(--carta-texto)", fontFamily: "var(--carta-fuente-cuerpo)" }}
          >
            {item.nombre}
          </h3>
          <span
            className="shrink-0 whitespace-nowrap text-[15px] font-bold tabular-nums sm:text-[17px]"
            style={{
              color: "var(--carta-primario)",
              fontFamily: "var(--carta-fuente-titulos)",
            }}
          >
            {item.precio.toFixed(2).replace(".", ",")}€
          </span>
        </div>

        {item.descripcion ? (
          <p
            className="mt-1.5 line-clamp-2 text-[13px] font-light leading-snug sm:text-[13.5px]"
            style={{ color: "var(--carta-texto-suave)" }}
          >
            {item.descripcion}
          </p>
        ) : null}

        {/* Alérgenos chips */}
        {item.alergenos.length > 0 ? (
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
        ) : null}

        {/* Likes */}
        {likes > 0 || liked ? (
          <div className="mt-auto flex items-center gap-1 pt-2">
            <Heart
              className={`h-3 w-3 ${liked ? "fill-current" : ""}`}
              strokeWidth={1.75}
              style={{ color: liked ? "var(--carta-primario)" : "var(--carta-texto-tenue)" }}
            />
            <span className="text-[10px] font-medium tabular-nums" style={{ color: "var(--carta-texto-tenue)" }}>
              {likes}
            </span>
          </div>
        ) : null}
      </div>
    </button>
  );
}
