"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Suscribe a UPDATEs de carta_items y mantiene un mapa { item_id -> likes_count }.
 * Inicial vacío; el componente usa item.likes_count como fallback.
 */
export function useLikesRealtime(itemIds: string[]): {
  counters: Record<string, number>;
  fijar: (itemId: string, total: number) => void;
} {
  const [counters, setCounters] = useState<Record<string, number>>({});

  useEffect(() => {
    if (itemIds.length === 0) return;
    const supabase = createClient();
    const ids = new Set(itemIds);

    const channel = supabase
      .channel("carta_items_likes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "carta_items" },
        (payload) => {
          const row = payload.new as { id: string; likes_count: number; likes_base?: number | null } | null;
          if (!row || !ids.has(row.id)) return;
          setCounters((prev) =>
            // El contador visible es base + votos: si aquí se guardara solo
            // `likes_count`, al votar el número CAERÍA de golpe al perder la base.
            (() => {
              const total = (row.likes_base ?? 0) + row.likes_count;
              return prev[row.id] === total ? prev : { ...prev, [row.id]: total };
            })(),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [itemIds]);

  /**
   * Fija el total de un plato sin esperar al canal.
   *
   * El servidor ya devuelve el número correcto al votar, y esperar al aviso en
   * vivo dejaba el contador quieto un segundo o —si el canal no conecta— para
   * siempre: pulsabas y no pasaba nada.
   */
  const fijar = useCallback((itemId: string, total: number) => {
    setCounters((prev) => (prev[itemId] === total ? prev : { ...prev, [itemId]: total }));
  }, []);

  return { counters, fijar };
}
