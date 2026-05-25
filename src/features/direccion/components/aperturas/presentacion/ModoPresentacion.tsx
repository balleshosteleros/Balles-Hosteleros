"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Loader2, Monitor, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EstudioApertura } from "@/features/direccion/data/aperturas";
import { getBrandConfig, type BrandConfig } from "@/features/empresa/actions/logo-actions";
import { SLIDES_APERTURA, SlidesAperturaRenderer } from "./SlidesAperturaRenderer";
import { PresentacionMinimapa } from "./PresentacionMinimapa";

/**
 * Modo Presentación full-screen del estudio de apertura (PRP-038).
 *
 * - Renderiza vía createPortal en document.body para escapar del flujo de tabs.
 * - Carga branding (logo + paleta) de `empresas` vía getBrandConfig.
 * - Aplica branding como CSS vars en el contenedor raíz.
 * - Navegación: ← / → / Espacio / PageUp / PageDown. Esc cierra.
 * - Minimapa lateral con auto-hide para navegar a cualquier slide.
 * - Impresión PDF: window.print() oculta el chrome y renderiza TODAS las
 *   slides como páginas A4 landscape con `page-break-after: always`.
 */
const FALLBACK: Partial<BrandConfig> = {
  colorPrimario: "#0f172a",
  colorSecundario: "#1d4ed8",
  colorTexto: "#ffffff",
  logoUrl: null,
};

const PRINT_STYLE = `
@media print {
  @page { size: A4 landscape; margin: 0; }
  body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: white !important; }
  .ap-modo-screen, .no-print { display: none !important; }
  .ap-modo-print { display: block !important; }
  .ap-modo-print-slide {
    width: 100vw;
    height: 100vh;
    page-break-after: always;
    break-inside: avoid;
    overflow: hidden;
  }
  .ap-modo-print-slide:last-child { page-break-after: auto; }
}
@media screen {
  .ap-modo-print { display: none; }
}
`.trim();

export function ModoPresentacion({
  estudio,
  empresaSlug,
  onExit,
}: {
  estudio: EstudioApertura;
  empresaSlug: string;
  onExit: () => void;
}) {
  const [brand, setBrand] = useState<BrandConfig | null>(null);
  const [brandError, setBrandError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await getBrandConfig(empresaSlug);
        if (!cancelado) setBrand(res ?? (FALLBACK as BrandConfig));
      } catch (err) {
        if (!cancelado) {
          setBrandError(err instanceof Error ? err.message : "Error cargando branding");
          setBrand(FALLBACK as BrandConfig);
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [empresaSlug]);

  const total = SLIDES_APERTURA.length;
  const siguiente = useCallback(() => setIdx((i) => Math.min(i + 1, total - 1)), [total]);
  const anterior = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        siguiente();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        anterior();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onExit();
      } else if (e.key === "Home") {
        setIdx(0);
      } else if (e.key === "End") {
        setIdx(total - 1);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
        // Dejamos que el navegador maneje Cmd/Ctrl+P; nuestro print stylesheet hace el resto.
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [siguiente, anterior, onExit, total]);

  if (!mounted) return null;

  const cssVars = {
    "--brand-primary": brand?.colorPrimario ?? FALLBACK.colorPrimario,
    "--brand-secondary": brand?.colorSecundario ?? FALLBACK.colorSecundario,
    "--brand-text": brand?.colorTexto ?? FALLBACK.colorTexto,
    "--brand-logo": brand?.logoUrl ? `url(${brand.logoUrl})` : "none",
  } as React.CSSProperties;

  const slide = SLIDES_APERTURA[idx];

  const overlay = (
    <>
      <style>{PRINT_STYLE}</style>

      {/* Vista en pantalla */}
      <div
        className="ap-modo-screen fixed inset-0 z-[60] flex flex-col bg-black"
        style={cssVars}
        role="dialog"
        aria-modal="true"
        aria-label="Modo Presentación"
      >
        {/* Chrome superior (auto-hide) */}
        <div className="no-print absolute top-0 left-0 right-0 z-30 flex items-center justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 py-3 text-white opacity-0 hover:opacity-100 transition-opacity">
          <div className="text-xs uppercase tracking-widest opacity-80">
            {idx + 1} / {total} · {slide.titulo}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => window.print()}
              className="gap-1.5 text-white hover:bg-white/10 hover:text-white"
              title="Imprimir o guardar como PDF (Cmd/Ctrl + P)"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir / PDF
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onExit}
              className="gap-1.5 text-white hover:bg-white/10 hover:text-white"
            >
              <Monitor className="h-3.5 w-3.5" />
              Volver al software
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onExit}
              className="text-white hover:bg-white/10 hover:text-white"
              aria-label="Salir"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Minimapa lateral */}
        <PresentacionMinimapa slides={SLIDES_APERTURA} activeIdx={idx} onSelect={setIdx} />

        {/* Slide visible */}
        <div className="flex-1 overflow-hidden">
          {brand ? (
            <SlidesAperturaRenderer estudio={estudio} slideKey={slide.key} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/80">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
        </div>

        {/* Flechas laterales */}
        <button
          type="button"
          onClick={anterior}
          disabled={idx === 0}
          className="no-print absolute left-0 top-1/2 z-20 -translate-y-1/2 p-3 text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
          aria-label="Anterior"
        >
          <ChevronLeft className="h-10 w-10" />
        </button>
        <button
          type="button"
          onClick={siguiente}
          disabled={idx === total - 1}
          className="no-print absolute right-0 top-1/2 z-20 -translate-y-1/2 p-3 text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
          aria-label="Siguiente"
        >
          <ChevronRight className="h-10 w-10" />
        </button>

        {/* Barra de progreso */}
        <div className="no-print absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <div
            className="h-full bg-white/60 transition-all"
            style={{ width: `${((idx + 1) / total) * 100}%` }}
          />
        </div>

        {brandError && (
          <div className="no-print absolute bottom-4 left-4 max-w-md rounded-md bg-red-500/90 px-3 py-2 text-xs text-white">
            {brandError}
          </div>
        )}
      </div>

      {/* Layout de impresión: TODAS las slides en orden, ocultas en pantalla.
          Usa las mismas CSS vars del branding para que los colores salgan en el PDF. */}
      <div className="ap-modo-print" style={cssVars}>
        {brand &&
          SLIDES_APERTURA.map((s) => (
            <div key={s.key} className="ap-modo-print-slide">
              <SlidesAperturaRenderer estudio={estudio} slideKey={s.key} />
            </div>
          ))}
      </div>
    </>
  );

  return createPortal(overlay, document.body);
}
