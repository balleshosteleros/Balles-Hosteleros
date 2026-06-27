"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Widths = Record<string, number>;

interface ResizableColumnsCtx {
  enabled: boolean;
  widths: Widths;
  startResize: (key: string, e: React.MouseEvent, currentWidth: number) => void;
}

const Ctx = createContext<ResizableColumnsCtx>({
  enabled: false,
  widths: {},
  startResize: () => {},
});

const STORAGE_PREFIX = "col-widths:";
const MIN_WIDTH = 60;
const MAX_WIDTH = 800;

export function ResizableColumnsProvider({
  storageKey,
  children,
}: {
  storageKey: string;
  children: ReactNode;
}) {
  const [widths, setWidths] = useState<Widths>({});

  useEffect(() => {
    // Al cambiar de storageKey (p.ej. otra pestaña de productos) hay que RESETEAR
    // los anchos aunque la nueva clave no tenga nada guardado. Si no, los anchos de
    // la pestaña anterior se quedan pegados y descuadran columnas con claves comunes.
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + storageKey);
      setWidths(raw ? JSON.parse(raw) : {});
    } catch {
      setWidths({});
    }
  }, [storageKey]);

  const persist = useCallback(
    (next: Widths) => {
      try {
        localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
    },
    [storageKey],
  );

  const startResize = useCallback(
    (key: string, e: React.MouseEvent, currentWidth: number) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = currentWidth;
      let lastWidth = startWidth;

      function onMove(ev: MouseEvent) {
        const delta = ev.clientX - startX;
        lastWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + delta));
        setWidths((prev) => ({ ...prev, [key]: lastWidth }));
      }
      function onUp() {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setWidths((prev) => {
          const next = { ...prev, [key]: lastWidth };
          persist(next);
          return next;
        });
      }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [persist],
  );

  return (
    <Ctx.Provider value={{ enabled: true, widths, startResize }}>
      {children}
    </Ctx.Provider>
  );
}

export function useResizableColumn(key: string) {
  const ctx = useContext(Ctx);
  return {
    enabled: ctx.enabled,
    width: ctx.widths[key],
    startResize: (e: React.MouseEvent, currentWidth: number) =>
      ctx.startResize(key, e, currentWidth),
  };
}
