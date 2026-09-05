"use client";

import Image from "next/image";
import { Heart, Star } from "lucide-react";
import { AlergenoIcon } from "./FiltroAlergenos";
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
 * Los alérgenos se pintan como iconos pequeños bajo la descripción: quien
 * tiene una alergia necesita descartar de un vistazo, sin abrir plato por
 * plato. Van en gris y a 12px —se leen si los buscas, no compiten con la
 * foto— y el detalle con el nombre de cada uno sigue en la ficha del plato.
 */
export function ItemCard({
  item,
  likes,
  liked,
  onOpen,
  onLike,
}: {
  item: CartaItem;
  likes: number;
  liked: boolean;
  onOpen: () => void;
  /** Votar desde la propia tarjeta, sin abrir la ficha. */
  onLike?: () => void;
}) {
  // Precio 0 = el plato no se cobra aparte (va dentro de un menú cerrado).
  // Pintar "0,00 €" hacía pensar que era gratis; mejor no pintar nada y dejar
  // que el precio del menú lo diga el título de la categoría.
  const precio = item.precio > 0 ? `${item.precio.toFixed(2).replace(".", ",")}€` : null;
  const conFoto = !!item.foto_url;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex w-full flex-col overflow-hidden rounded-2xl text-left transition-all duration-500 ease-out hover:-translate-y-1 active:scale-[0.99]"
      style={{
        backgroundColor: "var(--carta-superficie)",
        // Los más vendidos llevan filete del color de marca: en una rejilla de
        // fotos, la estrella sola se pierde; el borde recorta la tarjeta entera.
        border: item.destacado
          ? "1.5px solid color-mix(in srgb, var(--carta-acento) 62%, transparent)"
          : "1.5px solid transparent",
        boxShadow: item.destacado
          ? "0 0 0 1px color-mix(in srgb, var(--carta-acento) 18%, transparent)"
          : undefined,
      }}
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
            // El recorte se ancla ARRIBA, no al centro: en foto de plato la
            // comida vive en la mitad superior y el centro suele caer en el
            // mantel, así que centrar cortaba justo lo que se quiere enseñar.
            className="object-cover object-[center_35%] transition-transform duration-[900ms] ease-out group-hover:scale-[1.07]"
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

        {/* Velo inferior: sostiene el precio sin oscurecer el plato. Sin precio
            que sostener, sobra: oscurecía la foto para nada. */}
        {precio ? (
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-2/5"
            style={{ background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.55) 100%)" }}
          />
        ) : null}

        {/* Precio en píldora de cristal sobre la foto. */}
        {precio ? (
        <span
          className="absolute bottom-2.5 right-2.5 rounded-full px-2.5 py-1 text-[13px] font-semibold tabular-nums text-white shadow-[0_2px_10px_rgba(0,0,0,0.35)] backdrop-blur-md sm:text-[14px]"
          style={{
            backgroundColor: "rgba(255,255,255,0.16)",
            fontFamily: "var(--carta-fuente-titulos)",
          }}
        >
          {precio}
        </span>
        ) : null}

        {item.destacado ? (
          // Estrella + rótulo: la estrella sola no dice por qué está ahí.
          <span
            className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/45 py-1 pl-1.5 pr-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.4)] ring-1 ring-white/25 backdrop-blur-md"
            title="Uno de los más pedidos"
          >
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" strokeWidth={1.5} />
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-white">
              Best seller
            </span>
          </span>
        ) : null}

        {/* Corazón SIEMPRE visible, no solo cuando ya hay votos: si aparece al
            recibir el primero, nadie sabe que se puede votar y no llega nunca.
            El contador va al lado para que se vea de un vistazo qué gusta. */}
        <span
          role="button"
          tabIndex={0}
          aria-label={liked ? "Quitar me gusta" : "Me gusta"}
          onClick={(e) => { e.stopPropagation(); onLike?.(); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onLike?.(); } }}
          className="absolute right-2.5 top-2.5 inline-flex cursor-pointer items-center gap-1 rounded-full bg-black/35 px-2 py-1 shadow-[0_2px_8px_rgba(0,0,0,0.35)] ring-1 ring-white/20 backdrop-blur-md transition-transform active:scale-90"
        >
            <Heart
              className={`h-3 w-3 transition-colors ${liked ? "fill-current text-rose-400" : "text-white"}`}
              strokeWidth={2}
            />
            <span className="text-[10px] font-semibold tabular-nums text-white">{likes}</span>
        </span>
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

        {/* Alérgenos del plato. `Sin alérgenos` es una declaración explícita
            (alguien lo ha revisado), no la ausencia de datos, así que también
            se muestra: al celíaco le sirve tanto saber qué lleva como saber
            que está comprobado. */}
        {item.alergenos.length > 0 ? (
          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            {item.alergenos.map((a) => (
              <span
                key={a}
                title={a}
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] leading-none"
                style={{
                  color: "var(--carta-texto-suave)",
                  border: "1px solid var(--carta-borde)",
                }}
              >
                <AlergenoIcon alergeno={a} className="h-3 w-3" />
                <span className="sr-only">{a}</span>
              </span>
            ))}
          </span>
        ) : null}
      </div>
    </button>
  );
}
