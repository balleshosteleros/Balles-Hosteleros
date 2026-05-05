"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, ChevronLeft, ChevronRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPresentacion } from "../actions/presentaciones-actions";
import { SlideRenderer } from "./SlideRenderer";
import type { PresentacionConSlides, Branding } from "../types/presentaciones";
import { Loader2 } from "lucide-react";

interface Props {
  presentacionId: string;
}

export function PresentarView({ presentacionId }: Props) {
  const router = useRouter();
  const [data, setData] = useState<PresentacionConSlides | null>(null);
  const [idx, setIdx] = useState(0);
  const [notasVisibles, setNotasVisibles] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await getPresentacion(presentacionId);
      if (res.ok && res.data) setData(res.data);
    })();
  }, [presentacionId]);

  const slides = data?.slides ?? [];

  const siguiente = useCallback(() => {
    setIdx((i) => Math.min(i + 1, slides.length - 1));
  }, [slides.length]);
  const anterior = useCallback(() => {
    setIdx((i) => Math.max(i - 1, 0));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        siguiente();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        anterior();
      } else if (e.key === "Escape") {
        router.push(`/direccion/presentaciones/${presentacionId}`);
      } else if (e.key === "n" || e.key === "N") {
        setNotasVisibles((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [siguiente, anterior, presentacionId, router]);

  if (!data) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const slide = slides[idx];
  const branding = (data.branding_snapshot ?? {}) as Partial<Branding>;

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-50">
      {/* Barra superior (desaparece sola) */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 text-white bg-gradient-to-b from-black/60 to-transparent opacity-0 hover:opacity-100 transition-opacity z-20">
        <div className="text-sm">
          {idx + 1} / {slides.length} · {data.titulo}
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setNotasVisibles((v) => !v)}
            className="text-white hover:text-white hover:bg-white/10"
          >
            {notasVisibles ? (
              <EyeOff className="h-4 w-4 mr-1.5" />
            ) : (
              <Eye className="h-4 w-4 mr-1.5" />
            )}
            Notas (N)
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              router.push(`/direccion/presentaciones/${presentacionId}`)
            }
            className="text-white hover:text-white hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Slide fullscreen */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-[90vw] max-h-[85vh] aspect-video">
          {slide && (
            <SlideRenderer
              slide={slide}
              branding={branding}
              className="rounded-lg shadow-2xl"
            />
          )}
        </div>
      </div>

      {/* Notas ponente */}
      {notasVisibles && slide?.notas && (
        <div className="bg-neutral-900 text-neutral-200 border-t border-neutral-700 p-4 max-h-40 overflow-y-auto">
          <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
            Notas del ponente
          </p>
          <p className="text-sm leading-relaxed">{slide.notas}</p>
        </div>
      )}

      {/* Controles laterales */}
      <button
        onClick={anterior}
        disabled={idx === 0}
        className="absolute left-0 top-1/2 -translate-y-1/2 p-3 text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed z-10"
        aria-label="Anterior"
      >
        <ChevronLeft className="h-10 w-10" />
      </button>
      <button
        onClick={siguiente}
        disabled={idx === slides.length - 1}
        className="absolute right-0 top-1/2 -translate-y-1/2 p-3 text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed z-10"
        aria-label="Siguiente"
      >
        <ChevronRight className="h-10 w-10" />
      </button>

      {/* Barra de progreso */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
        <div
          className="h-full bg-white/60 transition-all"
          style={{ width: `${((idx + 1) / slides.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
