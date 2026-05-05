"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CartaPublica, CartaItem, Alergeno } from "../../types";
import { buildCartaTheme, themeToCssVars, googleFontsHref } from "../../lib/theme";
import { useDeviceId } from "../../hooks/useDeviceId";
import { getLikesDelDevice } from "../../actions/like-actions";
import { useLikesRealtime } from "../../hooks/useLikesRealtime";
import { HeaderRestaurante } from "./HeaderRestaurante";
import { CategoriaSidebar } from "./CategoriaSidebar";
import { FiltroAlergenos } from "./FiltroAlergenos";
import { ItemList } from "./ItemList";
import { ItemFichaModal } from "./ItemFichaModal";

export function CartaPublicaShell({ carta }: { carta: CartaPublica }) {
  const theme = useMemo(() => buildCartaTheme(carta.empresa), [carta.empresa]);
  const cssVars = useMemo(() => themeToCssVars(theme), [theme]);
  const fontsHref = useMemo(
    () => googleFontsHref([theme.fuenteTitulos, theme.fuenteCuerpo]),
    [theme.fuenteTitulos, theme.fuenteCuerpo],
  );

  const deviceId = useDeviceId();
  const [activeCat, setActiveCat] = useState<string | null>(carta.categorias[0]?.id ?? null);
  const [openItem, setOpenItem] = useState<CartaItem | null>(null);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [filtroExcluidos, setFiltroExcluidos] = useState<Set<Alergeno>>(new Set());
  const listRef = useRef<HTMLDivElement | null>(null);

  const itemIds = useMemo(
    () => carta.categorias.flatMap((c) => c.items.map((i) => i.id)),
    [carta.categorias],
  );

  const counters = useLikesRealtime(itemIds);

  useEffect(() => {
    if (!deviceId || itemIds.length === 0) return;
    let cancelled = false;
    (async () => {
      const liked = await getLikesDelDevice(deviceId, itemIds);
      if (!cancelled) setLikedSet(new Set(liked));
    })();
    return () => {
      cancelled = true;
    };
  }, [deviceId, itemIds]);

  // Scroll-spy: observa qué categoría es la más visible.
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>("[data-cat-section]");
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const id = visible[0].target.getAttribute("data-cat-section");
          if (id) setActiveCat(id);
        }
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [carta.categorias]);

  const totalItems = useMemo(
    () => carta.categorias.reduce((acc, c) => acc + c.items.length, 0),
    [carta.categorias],
  );

  const itemsVisibles = useMemo(() => {
    if (filtroExcluidos.size === 0) return totalItems;
    return carta.categorias.reduce(
      (acc, c) => acc + c.items.filter((i) => !i.alergenos.some((a) => filtroExcluidos.has(a))).length,
      0,
    );
  }, [carta.categorias, filtroExcluidos, totalItems]);

  const openItemFinal = openItem
    ? (counters[openItem.id] ?? openItem.likes_count)
    : 0;

  const handleSelectCategoria = (id: string) => {
    setActiveCat(id);
    const el = document.getElementById(`cat-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleToggleLocalLike = (itemId: string, liked: boolean) => {
    setLikedSet((prev) => {
      const next = new Set(prev);
      if (liked) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  };

  return (
    <>
      {fontsHref ? <link rel="stylesheet" href={fontsHref} /> : null}
      <main style={cssVars} className="min-h-screen">
        <HeaderRestaurante empresa={carta.empresa} />

        <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 pt-8 lg:grid-cols-[220px_1fr] lg:gap-12 lg:pt-12">
            <CategoriaSidebar
              categorias={carta.categorias}
              activeId={activeCat}
              onSelect={handleSelectCategoria}
            />

            <div className="min-w-0">
              <FiltroAlergenos
                excluidos={filtroExcluidos}
                onChange={setFiltroExcluidos}
                totalItems={totalItems}
                itemsVisibles={itemsVisibles}
              />

              <ItemList
                ref={listRef}
                categorias={carta.categorias}
                filtroExcluidos={filtroExcluidos}
                counters={counters}
                likedSet={likedSet}
                estiloCards={theme.estiloCards}
                onOpen={setOpenItem}
              />
            </div>
          </div>
        </div>

        <ItemFichaModal
          item={openItem}
          deviceId={deviceId}
          liked={openItem ? likedSet.has(openItem.id) : false}
          likesCount={openItemFinal}
          onClose={() => setOpenItem(null)}
          onToggleLocalLike={handleToggleLocalLike}
        />
      </main>
    </>
  );
}
