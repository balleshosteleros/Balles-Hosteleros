"use client";

import type { CartaItem } from "../../types";
import { ItemCard } from "./ItemCard";

export function ItemGrid({
  items,
  counters,
  likedSet,
  onOpen,
}: {
  items: CartaItem[];
  counters: Record<string, number>;
  likedSet: Set<string>;
  onOpen: (item: CartaItem) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="py-10 text-center text-stone-500">
        No hay platos en esta categoría todavía.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          likes={counters[item.id] ?? item.likes_count}
          liked={likedSet.has(item.id)}
          onOpen={() => onOpen(item)}
        />
      ))}
    </div>
  );
}
