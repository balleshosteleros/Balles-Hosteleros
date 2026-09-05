"use client";

import { forwardRef } from "react";
import type { CartaCategoria, CartaItem } from "../../types";
import { ItemCard } from "./ItemCard";

type CategoriaConItems = CartaCategoria & { items: CartaItem[] };

/**
 * Rejilla fotográfica.
 *
 * Dos columnas en móvil —no una— porque con foto grande a una columna hay que
 * hacer scroll eterno para ver la categoría entera, y el comensal se cansa
 * antes de llegar a los postres. Dos columnas dejan ver cuatro platos de un
 * vistazo sin encoger la foto hasta hacerla inútil.
 */
export const ItemList = forwardRef<HTMLDivElement, {
  categorias: CategoriaConItems[];
  filtroExcluidos: Set<string>;
  counters: Record<string, number>;
  likedSet: Set<string>;
  onOpen: (item: CartaItem) => void;
  onLike: (item: CartaItem) => void;
}>(function ItemList({ categorias, filtroExcluidos, counters, likedSet, onOpen, onLike }, ref) {
  return (
    <div ref={ref} className="flex flex-col gap-14">
      {categorias.map((cat) => {
        const items = cat.items.filter((i) => !i.alergenos.some((a) => filtroExcluidos.has(a)));

        return (
          <section key={cat.id} id={`cat-${cat.id}`} data-cat-section={cat.id} className="scroll-mt-36">
            <CategoryHeader
              nombre={cat.nombre}
              descripcion={cat.descripcion}
              count={items.length}
              total={cat.items.length}
            />

            {items.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:gap-5">
                {items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    likes={counters[item.id] ?? item.likes_base + item.likes_count}
                    liked={likedSet.has(item.id)}
                    onOpen={() => onOpen(item)}
                    onLike={() => onLike(item)}
                  />
                ))}
              </div>
            ) : (
              <p
                className="rounded-2xl px-4 py-8 text-center text-[12.5px] font-light italic"
                style={{
                  color: "var(--carta-texto-tenue)",
                  backgroundColor: "color-mix(in srgb, var(--carta-superficie-enfasis) 55%, transparent)",
                }}
              >
                {cat.items.length > 0
                  ? "Todos los platos de esta categoría contienen alérgenos que has excluido."
                  : "Próximamente."}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
});

function CategoryHeader({
  nombre,
  descripcion,
  count,
  total,
}: {
  nombre: string;
  descripcion: string | null;
  count: number;
  total: number;
}) {
  const filtrados = total > count;

  return (
    <header className="mb-6">
      {/* Filete corto sobre el título: separa categorías sin una línea que
          cruce toda la rejilla y la parta en dos. */}
      <div
        className="mb-3 h-[2px] w-10 rounded-full"
        style={{ background: "var(--carta-acento)" }}
      />

      <div className="flex items-baseline gap-3">
        <h2
          className="text-[26px] font-light leading-none tracking-[0.01em] sm:text-[34px]"
          style={{ fontFamily: "var(--carta-fuente-titulos)", color: "var(--carta-texto)" }}
        >
          {nombre}
        </h2>
        <span
          className="text-[10px] font-semibold uppercase tabular-nums tracking-[0.22em]"
          style={{ color: "var(--carta-texto-tenue)" }}
        >
          {filtrados ? `${count} / ${total}` : count}
        </span>
      </div>

      {descripcion ? (
        <p
          className="mt-2 max-w-2xl text-[13px] font-light italic leading-relaxed"
          style={{ color: "var(--carta-texto-suave)", fontFamily: "var(--carta-fuente-titulos)" }}
        >
          {descripcion}
        </p>
      ) : null}
    </header>
  );
}
