"use client";

import type { CartaCategoria, CartaItem } from "../../types";

type CategoriaConItems = CartaCategoria & { items: CartaItem[] };

export function CategoriaTabs({
  categorias,
  destacadosCount,
  activeId,
  onChange,
}: {
  categorias: CategoriaConItems[];
  destacadosCount: number;
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <nav className="sticky top-0 z-10 -mx-4 mb-4 overflow-x-auto bg-stone-50/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-stone-50/70">
      <ul className="flex gap-2">
        {destacadosCount > 0 ? (
          <li>
            <button
              type="button"
              onClick={() => onChange("destacados")}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                activeId === "destacados"
                  ? "bg-amber-500 text-white shadow"
                  : "bg-white text-stone-700 ring-1 ring-stone-200"
              }`}
            >
              ⭐ Destacados
            </button>
          </li>
        ) : null}
        {categorias.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onChange(c.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                activeId === c.id
                  ? "bg-stone-900 text-white shadow"
                  : "bg-white text-stone-700 ring-1 ring-stone-200"
              }`}
            >
              {c.nombre}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
