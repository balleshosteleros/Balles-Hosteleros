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
 * Las dietas especiales (celíacos, veganos, niños) van juntas al final y se
 * separan del resto con un filete fino y un punto: lo justo para encontrarlas
 * de un vistazo. Recuadrarlas las convertía en un reclamo, y no lo son: son
 * una respuesta para quien ya viene buscándolas.
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

  // Solo se ofrecen las familias que esta carta usa: un local sin shishas no
  // debe enseñar un botón "Otros" vacío.
  const familias = useMemo(() => {
    const orden: FamiliaCarta[] = ["comida", "bebida", "otros"];
    return orden.filter((f) => categorias.some((c) => (c.familia ?? "comida") === f));
  }, [categorias]);

  // Auto-scroll del item activo en la sidebar (mobile + desktop scroll si overflow).
  useEffect(() => {
    if (!activeId) return;
    const el = navRef.current?.querySelector<HTMLElement>(`[data-cat="${activeId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeId]);

  const ETIQUETA: Record<FamiliaCarta, string> = {
    comida: "Comida",
    bebida: "Bebida",
    otros: "Otros",
  };

  const selectorFamilia = familias.length > 1 ? (
    <div
      className="flex gap-1 rounded-full p-1"
      style={{ backgroundColor: "color-mix(in srgb, var(--carta-superficie-enfasis) 70%, transparent)" }}
    >
      {familias.map((f) => {
        const on = familia === f;
        return (
          <button
            key={f}
            type="button"
            onClick={() => onFamilia(f)}
            className="min-w-0 flex-1 whitespace-nowrap rounded-full px-2.5 py-2 text-center text-[10.5px] font-semibold uppercase tracking-[0.1em] transition-all sm:px-3"
            style={{
              backgroundColor: on ? "var(--carta-primario)" : "transparent",
              color: on ? "var(--carta-sobre-marca)" : "var(--carta-texto-tenue)",
            }}
          >
            {ETIQUETA[f]}
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
                  className="relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition"
                  style={{
                    color: active ? "var(--carta-primario)" : "var(--carta-texto-tenue)",
                  }}
                >
                  {c.destacada ? (
                    <span
                      aria-hidden
                      className="inline-block h-1 w-1 rounded-full"
                      style={{ backgroundColor: "var(--carta-acento)", opacity: 0.75 }}
                    />
                  ) : null}
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
                    className="group relative flex w-full items-center gap-2 rounded-md py-2 pl-4 pr-3 text-left text-[12px] font-semibold uppercase tracking-[0.16em] transition-all"
                    style={{
                      color: active ? "var(--carta-primario)" : "var(--carta-texto-tenue)",
                      backgroundColor: active
                        ? "color-mix(in srgb, var(--carta-primario) 8%, transparent)"
                        : "transparent",
                    }}
                  >
                    {/* Filete izquierdo: marca el activo y, en tono de acento,
                        distingue las dietas sin recuadrarlas. */}
                    <span
                      className="absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r-full transition-all"
                      style={{
                        width: active ? 3 : c.destacada ? 2 : 0,
                        backgroundColor: active ? "var(--carta-primario)" : "var(--carta-acento)",
                        opacity: active ? 1 : 0.55,
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
