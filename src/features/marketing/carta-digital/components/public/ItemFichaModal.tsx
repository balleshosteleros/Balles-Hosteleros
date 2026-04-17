"use client";

import Image from "next/image";
import { useEffect } from "react";
import type { CartaItem } from "../../types";
import { LikeButton } from "./LikeButton";

const ALERGENO_LABEL: Record<string, string> = {
  gluten: "Gluten",
  crustaceos: "Crustáceos",
  huevos: "Huevos",
  pescado: "Pescado",
  cacahuetes: "Cacahuetes",
  soja: "Soja",
  lacteos: "Lácteos",
  frutos_cascara: "Frutos cáscara",
  apio: "Apio",
  mostaza: "Mostaza",
  sesamo: "Sésamo",
  sulfitos: "Sulfitos",
  altramuces: "Altramuces",
  moluscos: "Moluscos",
};

export function ItemFichaModal({
  item,
  deviceId,
  liked,
  likesCount,
  onClose,
  onToggleLocalLike,
}: {
  item: CartaItem | null;
  deviceId: string | null;
  liked: boolean;
  likesCount: number;
  onClose: () => void;
  onToggleLocalLike: (itemId: string, liked: boolean) => void;
}) {
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-xl shadow ring-1 ring-stone-200"
        >
          ×
        </button>

        <div className="relative aspect-square w-full overflow-hidden bg-stone-100 sm:aspect-[4/3]">
          {item.foto_url ? (
            <Image
              src={item.foto_url}
              alt={item.nombre}
              fill
              sizes="(max-width: 640px) 100vw, 600px"
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-6xl text-stone-300">
              🍽️
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold leading-tight">{item.nombre}</h2>
              <p className="mt-1 text-2xl font-bold text-stone-900">
                {item.precio.toFixed(2)} €
              </p>
            </div>
            <LikeButton
              itemId={item.id}
              deviceId={deviceId}
              liked={liked}
              likesCount={likesCount}
              onToggleLocal={onToggleLocalLike}
            />
          </div>

          {item.descripcion ? (
            <p className="text-base leading-relaxed text-stone-700">{item.descripcion}</p>
          ) : null}

          {item.alergenos.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                Alérgenos
              </p>
              <div className="flex flex-wrap gap-2">
                {item.alergenos.map((a) => (
                  <span
                    key={a}
                    className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900"
                  >
                    {ALERGENO_LABEL[a] ?? a}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
