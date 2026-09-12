"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { CartaCategoria, CartaItem, CartaFamilia, FamiliaCarta } from "../../types";

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
  familiasCfg,
}: {
  categorias: CategoriaConItems[];
  activeId: string | null;
  onSelect: (id: string) => void;
  familia: FamiliaCarta;
  onFamilia: (f: FamiliaCarta) => void;
  /** Apartados configurados en Ajustes: nombre y orden los pone la empresa. */
  familiasCfg: CartaFamilia[];
}) {
  const navRef = useRef<HTMLUListElement | null>(null);
  // El desplegable de categorías del móvil. Nace cerrado: abierto de entrada
  // taparía la primera fila de fotos, que es lo que hace entrar en la carta.
  const [menuAbierto, setMenuAbierto] = useState(false);

  // Una categoría sin familia asignada se trata como comida: es lo que era
  // antes de existir la separación, y así nunca desaparece de la carta.
  const deFamilia = useMemo(
    () => categorias.filter((c) => (c.familia ?? "comida") === familia),
    [categorias, familia],
  );

  // Solo se ofrecen las familias que esta carta usa: un local sin shishas no
  // debe enseñar un botón "Otros" vacío.
  const familias = useMemo(
    () =>
      [...familiasCfg]
        .sort((a, b) => a.orden - b.orden)
        .filter((f) => categorias.some((c) => (c.familia ?? "comida") === f.clave)),
    [categorias, familiasCfg],
  );

  const actual = deFamilia.find((c) => c.id === activeId) ?? deFamilia[0];

  // Al cambiar de familia se cierra: lo que se ve dentro ya es otra cosa.
  useEffect(() => {
    setMenuAbierto(false);
  }, [familia]);

  // Auto-scroll del item activo en la sidebar (mobile + desktop scroll si overflow).
  useEffect(() => {
    if (!activeId) return;
    const el = navRef.current?.querySelector<HTMLElement>(`[data-cat="${activeId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeId]);

  const selectorFamilia = familias.length > 1 ? (
    <div
      className="flex gap-1 rounded-full p-1"
      style={{ backgroundColor: "color-mix(in srgb, var(--carta-superficie-enfasis) 70%, transparent)" }}
    >
      {familias.map((f) => {
        const on = familia === f.clave;
        return (
          <button
            key={f.clave}
            type="button"
            onClick={() => onFamilia(f.clave)}
            className="min-w-0 flex-1 whitespace-nowrap rounded-full px-2.5 py-2 text-center text-[10.5px] font-semibold uppercase tracking-[0.1em] transition-all sm:px-3"
            style={{
              backgroundColor: on ? "var(--carta-primario)" : "transparent",
              color: on ? "var(--carta-sobre-marca)" : "var(--carta-texto-tenue)",
            }}
          >
            {f.nombre}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <>
      {/* Móvil: familias y, debajo, la carta en un desplegable */}
      <nav
        className="sticky top-0 z-20 -mx-4 mb-6 mt-4 border-b px-4 pt-3 backdrop-blur lg:hidden"
        style={{
          backgroundColor: "color-mix(in srgb, var(--carta-fondo) 92%, transparent)",
          borderColor: "var(--carta-borde)",
        }}
      >
        {selectorFamilia}

        {/* La carta entera, desplegada. Antes era una tira con scroll lateral
            y solo se veían dos categorías de doce: el resto quedaba fuera de
            pantalla sin nada que avisara de que había más, así que en el móvil
            la carta parecía tener la mitad. El desplegable las enseña todas,
            que es lo que ya se ve en el ordenador. */}
        <button
          type="button"
          onClick={() => setMenuAbierto((v) => !v)}
          aria-expanded={menuAbierto}
          className="my-2 flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left transition active:scale-[0.99]"
          style={{
            backgroundColor: "color-mix(in srgb, var(--carta-superficie-enfasis) 70%, transparent)",
            border: "1px solid var(--carta-borde)",
          }}
        >
          <span className="min-w-0">
            <span
              className="block text-[9px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: "var(--carta-texto-tenue)" }}
            >
              Ver la carta
            </span>
            <span
              className="block truncate text-[13px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: "var(--carta-primario)" }}
            >
              {actual?.nombre ?? "Elige categoría"}
            </span>
          </span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 transition-transform ${menuAbierto ? "rotate-180" : ""}`}
            style={{ color: "var(--carta-texto-tenue)" }}
            strokeWidth={2}
          />
        </button>

        {menuAbierto ? (
          <ul ref={navRef} className="mb-3 max-h-[55vh] overflow-y-auto pb-1">
            {deFamilia.map((c) => {
              const active = activeId === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    data-cat={c.id}
                    onClick={() => {
                      onSelect(c.id);
                      setMenuAbierto(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[12px] font-semibold uppercase tracking-[0.14em] transition"
                    style={{
                      color: active ? "var(--carta-primario)" : "var(--carta-texto-tenue)",
                      backgroundColor: active
                        ? "color-mix(in srgb, var(--carta-primario) 10%, transparent)"
                        : "transparent",
                    }}
                  >
                    {c.destacada ? (
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: "var(--carta-acento)", opacity: 0.8 }}
                      />
                    ) : null}
                    <span className="truncate">{c.nombre}</span>
                    <span
                      className="ml-auto shrink-0 text-[10px] font-medium tabular-nums opacity-70"
                      style={{ color: "var(--carta-texto-tenue)" }}
                    >
                      {c.items.length}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
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
