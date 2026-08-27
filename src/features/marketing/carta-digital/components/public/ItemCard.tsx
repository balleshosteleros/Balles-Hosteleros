"use client";

import Image from "next/image";
import { Heart, Star } from "lucide-react";
import type { CartaItem } from "../../types";

/**
 * Ficha de plato — formato fotográfico.
 *
 * La foto es lo que vende, así que ocupa el ancho completo de la tarjeta y el
 * texto vive debajo, no al lado: una foto de 96px compite con el texto y
 * pierde; una foto a sangre de 4:3 es la que hace levantar la vista de la
 * carta y pedir el plato.
 *
 * El precio va sobre la foto, en una píldora de cristal: así el ojo hace un
 * solo recorrido (foto → precio → nombre) en vez de saltar a una columna
 * derecha. Es el patrón de Mr Yum / Sunday, y es el que mejor convierte.
 *
 * Los alérgenos NO se pintan aquí: en un grid de fotos son ruido visual y
 * nadie los lee a ese tamaño. Viven en la ficha del plato, que es donde
 * alguien con una alergia va a mirar de verdad.
 */
export function ItemCard({
  item,
  likes,
  liked,
  onOpen,
}: {
  item: CartaItem;
  likes: number;
  liked: boolean;
  onOpen: () => void;
}) {
  const precio = `${item.precio.toFixed(2).replace(".", ",")}€`;
  const conFoto = !!item.foto_url;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex w-full flex-col overflow-hidden rounded-2xl text-left transition-all duration-500 ease-out hover:-translate-y-1 active:scale-[0.99]"
      style={{ backgroundColor: "var(--carta-superficie)" }}
    >
      {/* ── Foto ────────────────────────────────────────────────────── */}
      <div
        className="relative aspect-[4/3] w-full overflow-hidden"
        style={{ backgroundColor: "var(--carta-superficie-enfasis)" }}
      >
        {conFoto ? (
          <Image
            src={item.foto_url as string}
            alt={item.nombre}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px"
            className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.07]"
          />
        ) : (
          // Sin foto: un lienzo de marca vacío. NO se repite aquí el nombre
          // del plato —ya está justo debajo— porque leerlo dos veces seguidas
          // delata el hueco en lugar de disimularlo.
          <div
            className="h-full w-full"
            style={{
              background:
                "radial-gradient(120% 95% at 50% 0%, color-mix(in srgb, var(--carta-acento) 34%, transparent) 0%, var(--carta-superficie-enfasis) 72%)",
            }}
          />
        )}

        {/* Velo inferior: sostiene el precio sin oscurecer el plato. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-2/5"
          style={{ background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.55) 100%)" }}
        />

        {/* Precio en píldora de cristal sobre la foto. */}
        <span
          className="absolute bottom-2.5 right-2.5 rounded-full px-2.5 py-1 text-[13px] font-semibold tabular-nums text-white shadow-[0_2px_10px_rgba(0,0,0,0.35)] backdrop-blur-md sm:text-[14px]"
          style={{
            backgroundColor: "rgba(255,255,255,0.16)",
            fontFamily: "var(--carta-fuente-titulos)",
          }}
        >
          {precio}
        </span>

        {item.destacado ? (
          <span
            className="absolute left-2.5 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/35 shadow-[0_2px_8px_rgba(0,0,0,0.4)] ring-1 ring-white/25 backdrop-blur-md"
            title="Plato destacado"
          >
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" strokeWidth={1.5} />
          </span>
        ) : null}

        {likes > 0 || liked ? (
          <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-1 shadow-[0_2px_8px_rgba(0,0,0,0.35)] ring-1 ring-white/20 backdrop-blur-md">
            <Heart
              className={`h-3 w-3 text-white ${liked ? "fill-current" : ""}`}
              strokeWidth={2}
            />
            <span className="text-[10px] font-semibold tabular-nums text-white">{likes}</span>
          </span>
        ) : null}
      </div>

      {/* ── Texto ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col px-3 pb-3.5 pt-2.5">
        <h3
          className="text-[14.5px] font-medium leading-snug sm:text-[16px]"
          style={{ color: "var(--carta-texto)", fontFamily: "var(--carta-fuente-titulos)" }}
        >
          {item.nombre}
        </h3>

        {item.descripcion ? (
          <p
            className="mt-1 line-clamp-2 text-[12px] font-light leading-relaxed sm:text-[12.5px]"
            style={{ color: "var(--carta-texto-suave)" }}
          >
            {item.descripcion}
          </p>
        ) : null}
      </div>
    </button>
  );
}
