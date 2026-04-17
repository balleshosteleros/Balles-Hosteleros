"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Suscribe a UPDATEs de carta_items y mantiene un mapa { item_id -> likes_count }.
 * Inicial vacío; el componente usa item.likes_count como fallback.
 */
export function useLikesRealtime(itemIds: string[]): Record<string, number> {
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
          const row = payload.new as { id: string; likes_count: number } | null;
          if (!row || !ids.has(row.id)) return;
          setCounters((prev) =>
            prev[row.id] === row.likes_count ? prev : { ...prev, [row.id]: row.likes_count },
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [itemIds]);

  return counters;
}
