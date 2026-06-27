"use client";

import Image from "next/image";
import { useEffect } from "react";
import { X, Star, Utensils } from "lucide-react";
import type { CartaItem } from "../../types";
import { LikeButton } from "./LikeButton";
import { AlergenoIcon, alergenoLabel } from "./FiltroAlergenos";

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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-md sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-h-[94vh] w-full max-w-md animate-[fichaIn_.32s_cubic-bezier(.2,.9,.3,1.1)] overflow-y-auto rounded-t-[28px] shadow-2xl sm:max-w-lg sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: "var(--carta-superficie)", color: "var(--carta-texto)" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full shadow-sm backdrop-blur transition active:scale-90"
          style={{
            backgroundColor: "color-mix(in srgb, var(--carta-superficie) 80%, transparent)",
            color: "var(--carta-texto)",
          }}
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>

        {/* Hero foto */}
        <div
          className="relative aspect-[4/3] w-full overflow-hidden"
          style={{ backgroundColor: "var(--carta-superficie-enfasis)" }}
        >
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
            <div
              className="flex h-full w-full items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--carta-acento) 30%, var(--carta-superficie-enfasis)) 0%, var(--carta-superficie-enfasis) 100%)",
              }}
            >
              <Utensils className="h-16 w-16 opacity-30" strokeWidth={1} style={{ color: "var(--carta-primario)" }} />
            </div>
          )}

          {item.destacado ? (
            <span
              className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700 shadow-[0_2px_8px_rgba(180,83,9,0.45)] ring-1 ring-amber-200/80 backdrop-blur"
            >
              <Star className="h-3 w-3 fill-amber-400 text-amber-500 drop-shadow-[0_1px_1.5px_rgba(146,64,14,0.6)]" strokeWidth={1.5} />
              Destacado
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-5 px-6 pb-8 pt-6 sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2
                className="text-3xl font-light leading-tight tracking-tight sm:text-4xl"
                style={{ fontFamily: "var(--carta-fuente-titulos)", color: "var(--carta-texto)" }}
              >
                {item.nombre}
              </h2>
              <p
                className="mt-2 text-xl font-bold tabular-nums sm:text-2xl"
                style={{ color: "var(--carta-primario)", fontFamily: "var(--carta-fuente-titulos)" }}
              >
                {item.precio.toFixed(2).replace(".", ",")}€
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
            <p className="text-[15px] font-light leading-relaxed" style={{ color: "var(--carta-texto-suave)" }}>
              {item.descripcion}
            </p>
          ) : null}

          {item.alergenos.length > 0 ? (
            <div className="border-t pt-5" style={{ borderColor: "var(--carta-borde)" }}>
              <p
                className="mb-3 text-[10px] font-semibold uppercase tracking-[0.3em]"
                style={{ color: "var(--carta-texto-tenue)" }}
              >
                Contiene alérgenos
              </p>
              <div className="flex flex-wrap gap-1.5">
                {item.alergenos.map((a) => (
                  <span
                    key={a}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium"
                    style={{
                      borderColor: "var(--carta-borde)",
                      color: "var(--carta-texto-suave)",
                      backgroundColor: "color-mix(in srgb, var(--carta-superficie-enfasis) 60%, transparent)",
                    }}
                  >
                    <AlergenoIcon alergeno={a} className="h-3 w-3" />
                    {alergenoLabel(a)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <style jsx>{`
        @keyframes fichaIn {
          0% {
            transform: translateY(40px) scale(0.97);
            opacity: 0;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
