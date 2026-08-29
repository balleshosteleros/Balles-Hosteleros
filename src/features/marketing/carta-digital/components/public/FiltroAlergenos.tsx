"use client";

import { useEffect, useState } from "react";
import { X, Wheat, Egg, Fish, Nut, Milk, Bean, Leaf, Check } from "lucide-react";
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
  // "Sin alérgenos" no es un alérgeno sino su declaración contraria: lleva un
  // check, no una hoja, para que no se confunda con un ingrediente más.
  const Icon = alergeno === "Sin alérgenos" ? Check : (ALERGENO_ICON[alergeno as Alergeno] ?? Leaf);
  return <Icon className={className} strokeWidth={1.5} />;
}


/**
 * Icono de alérgenos: espiga dentro de un círculo tachado.
 *
 * El escudo genérico que había antes no decía nada —podía ser seguridad, o
 * privacidad—. La espiga tachada es el símbolo que se reconoce en cartas y
 * envases de medio mundo como "alérgenos e intolerancias", así que el comensal
 * que lo necesita lo identifica sin leer nada.
 */
export function IconoAlergenos({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* Tallo de la espiga */}
      <path d="M12 21V9" />
      {/* Granos, en tres pares que se abren hacia arriba */}
      <path d="M12 9c0-1.7-1-3-2.6-3.4C9 7.2 9.8 8.6 12 9Z" />
      <path d="M12 9c0-1.7 1-3 2.6-3.4C15 7.2 14.2 8.6 12 9Z" />
      <path d="M12 13c0-1.7-1-3-2.6-3.4C9 11.2 9.8 12.6 12 13Z" />
      <path d="M12 13c0-1.7 1-3 2.6-3.4C15 11.2 14.2 12.6 12 13Z" />
      <path d="M12 17c0-1.7-1-3-2.6-3.4C9 15.2 9.8 16.6 12 17Z" />
      <path d="M12 17c0-1.7 1-3 2.6-3.4C15 15.2 14.2 16.6 12 17Z" />
      {/* Barra de tachado: es lo que convierte la espiga en "alérgenos" */}
      <path d="M4.5 19.5 19.5 4.5" />
    </svg>
  );
}

/**
 * Filtro de alérgenos — botón discreto, no cartel.
 *
 * Antes ocupaba una franja entera encima de la carta con letras grandes; a la
 * mayoría de comensales no le afecta y se comía el sitio de la primera fila de
 * fotos. Ahora es un botón redondo con escudo, anclado abajo a la derecha, que
 * siempre está a mano mientras se hace scroll pero no le quita protagonismo a
 * los platos. Quien lo necesita lo busca; quien no, ni lo nota.
 *
 * Al pulsarlo abre un panel inferior con los 14 alérgenos UE.
 */
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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const toggle = (a: Alergeno) => {
    const next = new Set(excluidos);
    if (next.has(a)) next.delete(a);
    else next.add(a);
    onChange(next);
  };

  return (
    <>
      {/* ── Botón flotante ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          activeCount > 0
            ? `Filtro de alérgenos activo, ${activeCount} excluidos`
            : "Filtrar por alérgenos"
        }
        className="fixed bottom-5 right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full shadow-[0_6px_24px_rgba(0,0,0,0.28)] backdrop-blur-md transition-transform duration-200 active:scale-90 sm:bottom-6 sm:right-6"
        style={{
          backgroundColor:
            activeCount > 0
              ? "var(--carta-primario)"
              : "color-mix(in srgb, var(--carta-superficie) 88%, transparent)",
          color: activeCount > 0 ? "var(--carta-sobre-marca)" : "var(--carta-texto-suave)",
          border: "1px solid var(--carta-borde)",
        }}
      >
        <IconoAlergenos className="h-5 w-5" />
        {activeCount > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums ring-2"
            style={{
              backgroundColor: "var(--carta-acento)",
              color: "#1A1A1A",
              // El anillo tiñe del fondo de la carta para que el número no se
              // pegue al borde del botón.
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ["--tw-ring-color" as any]: "var(--carta-fondo)",
            }}
          >
            {activeCount}
          </span>
        ) : null}
      </button>

      {/* Aviso de platos ocultos: si el filtro está escondiendo comida, hay que
          decirlo, o el comensal piensa que la carta es más corta de lo que es. */}
      {activeCount > 0 && ocultos > 0 ? (
        <span
          className="fixed bottom-[76px] right-4 z-40 rounded-full px-3 py-1.5 text-[11px] font-medium tabular-nums shadow-[0_4px_16px_rgba(0,0,0,0.22)] backdrop-blur-md sm:bottom-[84px] sm:right-6"
          style={{
            backgroundColor: "color-mix(in srgb, var(--carta-superficie) 92%, transparent)",
            color: "var(--carta-texto-suave)",
            border: "1px solid var(--carta-borde)",
          }}
        >
          {ocultos} {ocultos === 1 ? "plato oculto" : "platos ocultos"}
        </span>
      ) : null}

      {/* ── Panel ───────────────────────────────────────────────────── */}
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md animate-[filtroIn_.28s_cubic-bezier(.2,.9,.3,1.05)] rounded-t-[26px] p-5 shadow-2xl sm:rounded-[26px]"
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "var(--carta-superficie)" }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p
                  className="text-[17px] font-light"
                  style={{ fontFamily: "var(--carta-fuente-titulos)", color: "var(--carta-texto)" }}
                >
                  Alérgenos
                </p>
                <p className="mt-0.5 text-[12px] font-light" style={{ color: "var(--carta-texto-tenue)" }}>
                  Marca lo que quieras evitar y ocultamos esos platos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition active:scale-90"
                style={{
                  backgroundColor: "var(--carta-superficie-enfasis)",
                  color: "var(--carta-texto-suave)",
                }}
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {ALERGENOS_UE.map((a) => {
                const active = excluidos.has(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggle(a)}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition"
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

            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onChange(new Set())}
                disabled={activeCount === 0}
                className="text-[11px] font-medium uppercase tracking-[0.16em] transition disabled:opacity-35"
                style={{ color: "var(--carta-texto-tenue)" }}
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-5 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] transition active:scale-95"
                style={{
                  backgroundColor: "var(--carta-primario)",
                  color: "var(--carta-sobre-marca)",
                }}
              >
                Ver {itemsVisibles} platos
              </button>
            </div>
          </div>

          <style jsx>{`
            @keyframes filtroIn {
              0% {
                transform: translateY(30px);
                opacity: 0;
              }
              100% {
                transform: translateY(0);
                opacity: 1;
              }
            }
          `}</style>
        </div>
      ) : null}
    </>
  );
}
