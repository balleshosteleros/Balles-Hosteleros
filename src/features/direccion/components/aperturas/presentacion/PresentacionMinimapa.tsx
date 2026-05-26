"use client";

import type { SlideAperturaItem } from "./SlidesAperturaRenderer";

/**
 * Minimapa lateral tipo PowerPoint: lista vertical de slides con número
 * y título. Click navega. Slide activa resaltada.
 *
 * Para piloto NO genera thumbnails reales (sería costoso de renderizar
 * en miniatura por cada slide). Si en feedback se pide, se añade en
 * iteración posterior con html2canvas o un sprite manual.
 */
export function PresentacionMinimapa({
  slides,
  activeIdx,
  onSelect,
}: {
  slides: SlideAperturaItem[];
  activeIdx: number;
  onSelect: (idx: number) => void;
}) {
  return (
    <div className="no-print absolute left-0 top-0 bottom-0 z-10 w-44 overflow-y-auto bg-black/40 px-2 py-12 opacity-0 hover:opacity-100 transition-opacity backdrop-blur-sm">
      <ul className="space-y-1">
        {slides.map((s, i) => {
          const activa = i === activeIdx;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors ${
                  activa
                    ? "bg-white/20 text-white"
                    : "text-white/60 hover:bg-white/10 hover:text-white/90"
                }`}
              >
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-white/10 text-[10px] font-mono">
                  {i + 1}
                </span>
                <span className="truncate font-medium">{s.titulo}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
