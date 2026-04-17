"use client";

import type { ProductoPOS } from "../types";

interface Props {
  productos: ProductoPOS[];
  categoriaActiva: string | null;
  onChange: (cat: string | null) => void;
}

export function CategoriaTabs({ productos, categoriaActiva, onChange }: Props) {
  const categorias = Array.from(new Set(productos.map((p) => p.categoria))).sort();

  const colores = [
    "bg-sky-500 hover:bg-sky-600",
    "bg-emerald-500 hover:bg-emerald-600",
    "bg-amber-500 hover:bg-amber-600",
    "bg-rose-500 hover:bg-rose-600",
    "bg-violet-500 hover:bg-violet-600",
    "bg-teal-500 hover:bg-teal-600",
  ];

  return (
    <div className="grid grid-cols-4 gap-2 md:grid-cols-6">
      <button
        onClick={() => onChange(null)}
        className={`flex h-14 items-center justify-center rounded-md border-2 text-xs font-bold uppercase text-white shadow-sm transition-all ${
          categoriaActiva === null ? "ring-4 ring-primary ring-offset-1" : ""
        } bg-slate-600 hover:bg-slate-700`}
      >
        Todas
      </button>
      {categorias.map((c, idx) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`flex h-14 items-center justify-center rounded-md border-2 px-2 text-xs font-bold uppercase text-white shadow-sm transition-all ${
            categoriaActiva === c ? "ring-4 ring-primary ring-offset-1" : ""
          } ${colores[idx % colores.length]}`}
        >
          <span className="line-clamp-2 text-center leading-tight">{c}</span>
        </button>
      ))}
    </div>
  );
}
