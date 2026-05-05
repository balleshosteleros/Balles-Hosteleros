"use client";

import { forwardRef } from "react";
import type { CartaCategoria, CartaItem, EstiloCards } from "../../types";
import { ItemCard } from "./ItemCard";

type CategoriaConItems = CartaCategoria & { items: CartaItem[] };

export const ItemList = forwardRef<HTMLDivElement, {
  categorias: CategoriaConItems[];
  filtroExcluidos: Set<string>;
  counters: Record<string, number>;
  likedSet: Set<string>;
  estiloCards: EstiloCards;
  onOpen: (item: CartaItem) => void;
}>(function ItemList({ categorias, filtroExcluidos, counters, likedSet, estiloCards, onOpen }, ref) {
  return (
    <div ref={ref} className="flex flex-col gap-12">
      {categorias.map((cat) => {
        const items = cat.items.filter((i) => !i.alergenos.some((a) => filtroExcluidos.has(a)));
        if (items.length === 0 && cat.items.length > 0) {
          // Categoría con todos los items filtrados
          return (
            <section key={cat.id} id={`cat-${cat.id}`} data-cat-section={cat.id} className="scroll-mt-32">
              <CategoryHeader nombre={cat.nombre} descripcion={cat.descripcion} count={0} total={cat.items.length} />
              <p
                className="rounded-xl px-4 py-6 text-center text-[12px] italic"
                style={{
                  color: "var(--carta-texto-tenue)",
                  backgroundColor: "color-mix(in srgb, var(--carta-superficie-enfasis) 60%, transparent)",
                }}
              >
                Todos los platos de esta categoría contienen alérgenos que has excluido.
              </p>
            </section>
          );
        }
        if (cat.items.length === 0) {
          return (
            <section key={cat.id} id={`cat-${cat.id}`} data-cat-section={cat.id} className="scroll-mt-32">
              <CategoryHeader nombre={cat.nombre} descripcion={cat.descripcion} count={0} total={0} />
              <p
                className="px-4 py-6 text-center text-[12px] italic"
                style={{ color: "var(--carta-texto-tenue)" }}
              >
                Próximamente.
              </p>
            </section>
          );
        }
        return (
          <section key={cat.id} id={`cat-${cat.id}`} data-cat-section={cat.id} className="scroll-mt-32">
            <CategoryHeader nombre={cat.nombre} descripcion={cat.descripcion} count={items.length} total={cat.items.length} />
            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  likes={counters[item.id] ?? item.likes_count}
                  liked={likedSet.has(item.id)}
                  estiloCards={estiloCards}
                  onOpen={() => onOpen(item)}
                />
              ))}
            </div>
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
    <header className="mb-5">
      <div className="flex items-baseline gap-3">
        <h2
          className="text-2xl font-light tracking-[0.02em] sm:text-3xl"
          style={{ fontFamily: "var(--carta-fuente-titulos)", color: "var(--carta-texto)" }}
        >
          {nombre}
        </h2>
        <span
          className="text-[10px] font-semibold uppercase tabular-nums tracking-[0.2em]"
          style={{ color: "var(--carta-texto-tenue)" }}
        >
          {filtrados ? `${count} / ${total}` : count}
        </span>
      </div>
      <div
        className="mt-3 h-px w-12"
        style={{ background: "linear-gradient(90deg, var(--carta-acento), transparent)" }}
      />
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
