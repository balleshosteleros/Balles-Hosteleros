"use client";

import Image from "next/image";
import type { CartaItem } from "../../types";

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
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-stone-200 transition active:scale-[0.98]"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-stone-100">
        {item.foto_url ? (
          <Image
            src={item.foto_url}
            alt={item.nombre}
            fill
            sizes="(max-width: 640px) 50vw, 33vw"
            className="object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-stone-300">
            🍽️
          </div>
        )}
        {likes > 0 ? (
          <div
            className={`absolute right-2 top-2 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold backdrop-blur ${
              liked ? "bg-rose-500/90 text-white" : "bg-white/90 text-stone-700"
            }`}
          >
            <span>{liked ? "❤️" : "🤍"}</span>
            <span>{likes}</span>
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="line-clamp-2 text-sm font-semibold leading-tight">{item.nombre}</span>
        <span className="text-base font-bold text-stone-900">
          {item.precio.toFixed(2)} €
        </span>
      </div>
    </button>
  );
}
