"use client";

import { useEffect, useMemo, useRef } from "react";
import type { CartaCategoria, CartaItem, FamiliaCarta } from "../../types";

type CategoriaConItems = CartaCategoria & { items: CartaItem[] };

/**
 * Navegación de la carta, en dos pisos.
 *
 * Con 23 categorías en una sola lista, encontrar los postres costaba tanto
 * como leerse la carta entera. Arriba se elige COMIDA o BEBIDA —la pregunta
 * que uno se hace primero— y debajo solo aparecen las categorías de esa
 * familia, que caben de un vistazo.
 *
 * Las dietas especiales (celíacos, veganos, niños) llevan un botón con filete
 * lateral y fondo propio: quien las necesita las localiza sin leer la lista
 * entera, y para el resto de comensales pasan desapercibidas.
 */
export function CategoriaSidebar({
  categorias,
  activeId,
  onSelect,
  familia,
  onFamilia,
}: {
  categorias: CategoriaConItems[];
  activeId: string | null;
  onSelect: (id: string) => void;
  familia: FamiliaCarta;
  onFamilia: (f: FamiliaCarta) => void;
}) {
  const navRef = useRef<HTMLUListElement | null>(null);

  // Una categoría sin familia asignada se trata como comida: es lo que era
  // antes de existir la separación, y así nunca desaparece de la carta.
  const deFamilia = useMemo(
    () => categorias.filter((c) => (c.familia ?? "comida") === familia),
    [categorias, familia],
  );

  const hayBebida = useMemo(
    () => categorias.some((c) => c.familia === "bebida"),
    [categorias],
  );

  // Auto-scroll del item activo en la sidebar (mobile + desktop scroll si overflow).
  useEffect(() => {
    if (!activeId) return;
    const el = navRef.current?.querySelector<HTMLElement>(`[data-cat="${activeId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeId]);

  const selectorFamilia = hayBebida ? (
    <div
      className="flex gap-1 rounded-full p-1"
      style={{ backgroundColor: "color-mix(in srgb, var(--carta-superficie-enfasis) 70%, transparent)" }}
    >
      {(["comida", "bebida"] as const).map((f) => {
        const on = familia === f;
        return (
          <button
            key={f}
            type="button"
            onClick={() => onFamilia(f)}
            className="flex-1 whitespace-nowrap rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition-all"
            style={{
              backgroundColor: on ? "var(--carta-primario)" : "transparent",
              color: on ? "var(--carta-sobre-marca)" : "var(--carta-texto-tenue)",
            }}
          >
            {f === "comida" ? "Comida" : "Bebida"}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <>
      {/* Mobile: familias + tabs horizontales, ambos pegados arriba */}
      <nav
        className="sticky top-0 z-20 -mx-4 mb-6 mt-4 border-b px-4 pt-3 backdrop-blur lg:hidden"
        style={{
          backgroundColor: "color-mix(in srgb, var(--carta-fondo) 92%, transparent)",
          borderColor: "var(--carta-borde)",
        }}
      >
        {selectorFamilia}
        <ul
          ref={navRef}
          className="flex gap-1 overflow-x-auto py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {deFamilia.map((c) => {
            const active = activeId === c.id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  data-cat={c.id}
                  onClick={() => onSelect(c.id)}
                  className={`relative inline-flex shrink-0 items-center whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                    c.destacada ? "rounded-full" : ""
                  }`}
                  style={{
                    color: active ? "var(--carta-primario)" : "var(--carta-texto-tenue)",
                    // Dietas especiales: fondo tenue de acento, siempre visible.
                    backgroundColor: c.destacada
                      ? "color-mix(in srgb, var(--carta-acento) 14%, transparent)"
                      : "transparent",
                    border: c.destacada
                      ? "1px solid color-mix(in srgb, var(--carta-acento) 42%, transparent)"
                      : "1px solid transparent",
                  }}
                >
                  {c.nombre}
                  {!c.destacada ? (
                    <span
                      className="absolute -bottom-px left-3 right-3 h-[2px] rounded-full transition-all"
                      style={{ backgroundColor: active ? "var(--carta-primario)" : "transparent" }}
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop: sidebar fija */}
      <aside className="sticky top-6 hidden self-start lg:block lg:max-h-[calc(100vh-48px)]">
        <div className="overflow-y-auto pr-2 lg:max-h-[calc(100vh-48px)]">
          {selectorFamilia ? <div className="mb-4">{selectorFamilia}</div> : null}
          <ul className="flex flex-col gap-0.5 py-1">
            {deFamilia.map((c) => {
              const active = activeId === c.id;
              return (
                <li key={c.id} className="relative">
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className={`group relative flex w-full items-center gap-2 py-2 pl-4 pr-3 text-left text-[12px] font-semibold uppercase tracking-[0.16em] transition-all ${
                      c.destacada ? "rounded-lg" : "rounded-md"
                    }`}
                    style={{
                      color: active ? "var(--carta-primario)" : "var(--carta-texto-tenue)",
                      backgroundColor: active
                        ? "color-mix(in srgb, var(--carta-primario) 8%, transparent)"
                        : c.destacada
                          ? "color-mix(in srgb, var(--carta-acento) 10%, transparent)"
                          : "transparent",
                      border: c.destacada
                        ? "1px solid color-mix(in srgb, var(--carta-acento) 38%, transparent)"
                        : "1px solid transparent",
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
