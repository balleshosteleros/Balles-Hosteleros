"use client";

/**
 * Sincroniza bloques entre editor (parent) y preview (iframe) en tiempo real
 * vía BroadcastChannel. Mismo origin → mínima latencia.
 */
import { useEffect } from "react";
import type { Bloque } from "../types";

const CANAL_PREFIX = "pagina-web:preview:";

export type MensajeBroadcast = {
  tipo: "actualizar_bloques";
  bloques: Bloque[];
};

export function emisorCanal(paginaId: string): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (typeof BroadcastChannel === "undefined") return null;
  return new BroadcastChannel(`${CANAL_PREFIX}${paginaId}`);
}

/** Hook del lado EDITOR: emite bloques cada vez que cambian. */
export function useBroadcastBloques(paginaId: string | null, bloques: Bloque[]) {
  useEffect(() => {
    if (!paginaId) return;
    const ch = emisorCanal(paginaId);
    if (!ch) return;
    const msg: MensajeBroadcast = { tipo: "actualizar_bloques", bloques };
    ch.postMessage(msg);
    return () => ch.close();
  }, [paginaId, bloques]);
}

/** Hook del lado PREVIEW (iframe): recibe bloques y los aplica. */
export function useListenBloques(
  paginaId: string | null,
  onMessage: (bloques: Bloque[]) => void,
) {
  useEffect(() => {
    if (!paginaId) return;
    const ch = emisorCanal(paginaId);
    if (!ch) return;
    const handler = (e: MessageEvent<MensajeBroadcast>) => {
      if (e.data?.tipo === "actualizar_bloques") onMessage(e.data.bloques);
    };
    ch.addEventListener("message", handler);
    return () => {
      ch.removeEventListener("message", handler);
      ch.close();
    };
  }, [paginaId, onMessage]);
}
