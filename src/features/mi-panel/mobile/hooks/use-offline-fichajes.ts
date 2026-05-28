"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  bumpRetries,
  countPending,
  deleteFromQueue,
  listQueue,
  type FichajeOfflineItem,
} from "../lib/offline-fichaje-db";
import { sincronizarFichajesOffline } from "@/features/mi-panel/actions/mi-panel-offline-actions";

const MAX_RETRIES = 5;

function monotonicNowMs(): number {
  if (typeof performance !== "undefined") {
    return performance.timeOrigin + performance.now();
  }
  return Date.now();
}

export function useOfflineFichajes(onFlushed?: () => void) {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [pending, setPending] = useState<number>(0);
  const [flushing, setFlushing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setPending(await countPending());
    } catch {
      /* no IDB → ignorar */
    }
  }, []);

  const flush = useCallback(async () => {
    if (flushing) return;
    setFlushing(true);
    try {
      const queue = await listQueue();
      if (queue.length === 0) return;

      // Enriquecer cada item con offlineSeconds calculado en este momento.
      const nowMono = monotonicNowMs();
      const payload = queue.map((q) => ({
        kind: q.kind,
        fichajeId: q.fichajeId,
        deviceTimestampIso: q.deviceTimestampIso,
        deviceMonotonicMs: q.deviceMonotonicMs,
        offlineSeconds: Math.max(0, (nowMono - q.deviceMonotonicMs) / 1000),
        geo: q.geo ?? null,
      }));

      const res = await sincronizarFichajesOffline({ items: payload });
      if (!res.ok) {
        toast.error(res.error || "No se pudieron sincronizar los fichajes pendientes");
        // Aumentar retries para los items procesados
        await Promise.all(queue.map((q) => (q.id ? bumpRetries(q.id) : Promise.resolve())));
        return;
      }

      let okCount = 0;
      let revisionCount = 0;
      for (let i = 0; i < queue.length; i++) {
        const item: FichajeOfflineItem = queue[i];
        const r = res.results[i];
        if (r?.ok) {
          if (item.id) await deleteFromQueue(item.id);
          okCount++;
          if (r.requiere_revision) revisionCount++;
        } else if (item.id) {
          await bumpRetries(item.id);
          if ((item.retries ?? 0) + 1 >= MAX_RETRIES) {
            await deleteFromQueue(item.id);
          }
        }
      }

      if (okCount > 0) {
        toast.success(
          revisionCount > 0
            ? `Sincronizados ${okCount} fichaje${okCount === 1 ? "" : "s"} (${revisionCount} marcados para revisión)`
            : `Sincronizados ${okCount} fichaje${okCount === 1 ? "" : "s"} pendiente${okCount === 1 ? "" : "s"}`,
        );
        onFlushed?.();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error sincronizando";
      toast.error(msg);
    } finally {
      setFlushing(false);
      await refresh();
    }
  }, [flushing, onFlushed, refresh]);

  useEffect(() => {
    refresh();
    const onOnline = () => {
      setOnline(true);
      void flush();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    // Flush al montar si ya está online.
    if (navigator.onLine) void flush();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { online, pending, flushing, flush, refresh };
}
