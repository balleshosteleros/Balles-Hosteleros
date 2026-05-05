"use client";

import { useEffect, useRef } from "react";
import type { CartaCategoria, CartaItem } from "../../types";

type CategoriaConItems = CartaCategoria & { items: CartaItem[] };

export function CategoriaSidebar({
  categorias,
  activeId,
  onSelect,
}: {
  categorias: CategoriaConItems[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const navRef = useRef<HTMLUListElement | null>(null);

  // Auto-scroll del item activo en la sidebar (mobile + desktop scroll si overflow).
  useEffect(() => {
    if (!activeId) return;
    const el = navRef.current?.querySelector<HTMLElement>(`[data-cat="${activeId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeId]);

  return (
    <>
      {/* Mobile: tabs horizontales sticky */}
      <nav
        className="sticky top-[44px] z-20 -mx-4 mb-4 border-b px-4 backdrop-blur lg:hidden"
        style={{
          backgroundColor: "color-mix(in srgb, var(--carta-fondo) 92%, transparent)",
          borderColor: "var(--carta-borde)",
        }}
      >
        <ul
          ref={navRef}
          className="flex gap-1 overflow-x-auto py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {categorias.map((c) => {
            const active = activeId === c.id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  data-cat={c.id}
                  onClick={() => onSelect(c.id)}
                  className="relative inline-flex shrink-0 items-center whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition"
                  style={{
                    color: active ? "var(--carta-primario)" : "var(--carta-texto-tenue)",
                  }}
                >
                  {c.nombre}
                  <span
                    className="absolute -bottom-px left-3 right-3 h-[2px] rounded-full transition-all"
                    style={{
                      backgroundColor: active ? "var(--carta-primario)" : "transparent",
                    }}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop: sidebar fija */}
      <aside className="sticky top-[60px] hidden self-start lg:block lg:max-h-[calc(100vh-80px)]">
        <div className="overflow-y-auto pr-2 lg:max-h-[calc(100vh-80px)]">
          <ul className="flex flex-col gap-0.5 py-2">
            {categorias.map((c) => {
              const active = activeId === c.id;
              return (
                <li key={c.id} className="relative">
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className="group relative flex w-full items-center gap-2 rounded-md py-2 pl-4 pr-3 text-left text-[12px] font-semibold uppercase tracking-[0.16em] transition-all"
                    style={{
                      color: active ? "var(--carta-primario)" : "var(--carta-texto-tenue)",
                      backgroundColor: active ? "color-mix(in srgb, var(--carta-primario) 8%, transparent)" : "transparent",
                    }}
                  >
                    <span
                      className="absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r-full transition-all"
                      style={{
                        width: active ? 3 : 0,
                        backgroundColor: "var(--carta-primario)",
                      }}
                    />
                    <span className="truncate">{c.nombre}</span>
                    <span
                      className="ml-auto rounded-full px-1.5 text-[10px] font-medium tabular-nums opacity-70"
                      style={{
                        color: active ? "var(--carta-primario)" : "var(--carta-texto-tenue)",
                      }}
                    >
                      {c.items.length}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </>
  );
}
