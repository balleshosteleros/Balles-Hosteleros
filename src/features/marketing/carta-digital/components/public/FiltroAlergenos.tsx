"use client";

import { useState } from "react";
import { Filter, X, Wheat, Egg, Fish, Nut, Milk, Bean, Leaf } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ALERGENOS_UE, type Alergeno } from "../../types";

const ALERGENO_ICON: Record<Alergeno, LucideIcon> = {
  "Gluten": Wheat,
  "Crustáceos": Fish,
  "Huevos": Egg,
  "Pescado": Fish,
  "Cacahuetes": Nut,
  "Soja": Bean,
  "Lácteos": Milk,
  "Frutos con cáscara": Nut,
  "Apio": Leaf,
  "Mostaza": Leaf,
  "Sésamo": Leaf,
  "Sulfitos": Leaf,
  "Altramuces": Bean,
  "Moluscos": Fish,
};

// El valor del catálogo ya es el label legible (PascalCase es-ES). Se mantiene
// el helper por compatibilidad con los componentes que lo importan.
export function alergenoLabel(a: Alergeno | string): string {
  return a;
}

export function AlergenoIcon({ alergeno, className }: { alergeno: Alergeno | string; className?: string }) {
  const Icon = ALERGENO_ICON[alergeno as Alergeno] ?? Leaf;
  return <Icon className={className} strokeWidth={1.5} />;
}

export function FiltroAlergenos({
  excluidos,
  onChange,
  totalItems,
  itemsVisibles,
}: {
  excluidos: Set<Alergeno>;
  onChange: (next: Set<Alergeno>) => void;
  totalItems: number;
  itemsVisibles: number;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = excluidos.size;
  const ocultos = totalItems - itemsVisibles;

  const toggle = (a: Alergeno) => {
    const next = new Set(excluidos);
    if (next.has(a)) next.delete(a);
    else next.add(a);
    onChange(next);
  };

  const clear = () => onChange(new Set());

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] transition"
          style={{
            borderColor: activeCount > 0 ? "var(--carta-primario)" : "var(--carta-borde)",
            color: activeCount > 0 ? "var(--carta-primario)" : "var(--carta-texto-suave)",
            backgroundColor: activeCount > 0 ? "color-mix(in srgb, var(--carta-primario) 8%, transparent)" : "transparent",
          }}
        >
          <Filter className="h-3.5 w-3.5" strokeWidth={1.75} />
          Sin alérgenos
          {activeCount > 0 ? (
            <span
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums"
              style={{ backgroundColor: "var(--carta-primario)", color: "var(--carta-sobre-marca)" }}
            >
              {activeCount}
            </span>
          ) : null}
        </button>

        {activeCount > 0 ? (
          <>
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] transition hover:opacity-100"
              style={{ color: "var(--carta-texto-tenue)" }}
            >
              <X className="h-3 w-3" strokeWidth={2} />
              Limpiar
            </button>
            {ocultos > 0 ? (
              <span
                className="ml-auto text-[11px] font-light tabular-nums italic"
                style={{ color: "var(--carta-texto-tenue)" }}
              >
                {ocultos} {ocultos === 1 ? "plato oculto" : "platos ocultos"}
              </span>
            ) : null}
          </>
        ) : null}
      </div>

      {open ? (
        <div
          className="mt-3 rounded-2xl border p-4 shadow-sm"
          style={{ backgroundColor: "var(--carta-superficie)", borderColor: "var(--carta-borde)" }}
        >
          <p
            className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em]"
            style={{ color: "var(--carta-texto-tenue)" }}
          >
            Excluir platos con
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ALERGENOS_UE.map((a) => {
              const active = excluidos.has(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggle(a)}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition"
                  style={{
                    backgroundColor: active ? "var(--carta-primario)" : "transparent",
                    borderColor: active ? "var(--carta-primario)" : "var(--carta-borde)",
                    color: active ? "var(--carta-sobre-marca)" : "var(--carta-texto-suave)",
                  }}
                >
                  <AlergenoIcon alergeno={a} className="h-3 w-3" />
                  {alergenoLabel(a)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
