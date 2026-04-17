"use client";

import { useEffect, useMemo, useState } from "react";
import type { CartaPublica, CartaItem } from "../../types";
import { useDeviceId } from "../../hooks/useDeviceId";
import { getLikesDelDevice } from "../../actions/like-actions";
import { useLikesRealtime } from "../../hooks/useLikesRealtime";
import { HeaderRestaurante } from "./HeaderRestaurante";
import { CategoriaTabs } from "./CategoriaTabs";
import { ItemGrid } from "./ItemGrid";
import { ItemFichaModal } from "./ItemFichaModal";

export function CartaPublicaShell({ carta }: { carta: CartaPublica }) {
  const deviceId = useDeviceId();
  const [activeCat, setActiveCat] = useState<string>(carta.categorias[0]?.id ?? "destacados");
  const [openItem, setOpenItem] = useState<CartaItem | null>(null);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());

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

  const itemsActivos = useMemo(() => {
    if (activeCat === "destacados") return carta.destacados;
    return carta.categorias.find((c) => c.id === activeCat)?.items ?? [];
  }, [activeCat, carta]);

  const handleToggleLocalLike = (itemId: string, liked: boolean) => {
    setLikedSet((prev) => {
      const next = new Set(prev);
      if (liked) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-6 sm:pt-10">
      <HeaderRestaurante empresa={carta.empresa} />

      <CategoriaTabs
        categorias={carta.categorias}
        destacadosCount={carta.destacados.length}
        activeId={activeCat}
        onChange={setActiveCat}
      />

      <ItemGrid
        items={itemsActivos}
        counters={counters}
        likedSet={likedSet}
        onOpen={setOpenItem}
      />

      <ItemFichaModal
        item={openItem}
        deviceId={deviceId}
        liked={openItem ? likedSet.has(openItem.id) : false}
        likesCount={openItem ? counters[openItem.id] ?? openItem.likes_count : 0}
        onClose={() => setOpenItem(null)}
        onToggleLocalLike={handleToggleLocalLike}
      />
    </main>
  );
}
