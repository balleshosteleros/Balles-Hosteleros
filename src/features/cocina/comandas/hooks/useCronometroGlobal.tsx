"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Cronómetro global: un único setInterval emite `now` al árbol.
 * Cada componente que necesita el tiempo llama a `useNow()`.
 * Evitamos un timer por tarjeta (re-render masivo cada segundo).
 */
const NowContext = createContext<number>(Date.now());

export function CronometroProvider({
  children,
  tickMs = 1000,
}: {
  children: ReactNode;
  tickMs?: number;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);

  return <NowContext.Provider value={now}>{children}</NowContext.Provider>;
}

export function useNow(): number {
  return useContext(NowContext);
}

/** Minutos transcurridos desde isoDate hasta el tick actual. */
export function useMinutosDesde(isoDate: string | null | undefined): number {
  const now = useNow();
  if (!isoDate) return 0;
  const t = new Date(isoDate).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((now - t) / 60_000);
}

/** Formato mm:ss desde isoDate. */
export function useTranscurrido(isoDate: string | null | undefined): string {
  const now = useNow();
  if (!isoDate) return "--:--";
  const t = new Date(isoDate).getTime();
  if (Number.isNaN(t)) return "--:--";
  const diff = Math.max(0, now - t);
  const totalSec = Math.floor(diff / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
