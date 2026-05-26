"use client";

import { useEffect, useRef } from "react";
import { useGlobalLoading } from "@/shared/stores/use-global-loading";

const DEFAULT_MESSAGE = "Cargando…";

/**
 * Sincroniza un estado de carga local con el overlay global.
 *
 * Uso típico en cualquier componente con `useState<boolean>(loading)`:
 *
 *   const [loading, setLoading] = useState(false);
 *   useGlobalLoadingSync(loading);
 *
 * Mensaje por defecto: "Cargando…" (mismo en todo el software).
 * Cada activación incrementa el contador del store, la desactivación lo
 * decrementa: seguro con varios componentes cargando en paralelo.
 */
export function useGlobalLoadingSync(active: boolean, message: string = DEFAULT_MESSAGE) {
  const show = useGlobalLoading((s) => s.show);
  const hide = useGlobalLoading((s) => s.hide);
  const wasActive = useRef(false);

  useEffect(() => {
    if (active && !wasActive.current) {
      show(message);
      wasActive.current = true;
    } else if (!active && wasActive.current) {
      hide();
      wasActive.current = false;
    }
  }, [active, message, show, hide]);

  useEffect(() => {
    return () => {
      if (wasActive.current) {
        hide();
        wasActive.current = false;
      }
    };
  }, [hide]);
}
