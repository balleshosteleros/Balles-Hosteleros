"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ViewMode = "paneles" | "departamentos";

export const VIEW_MODE_DASHBOARDS: Record<ViewMode, string> = {
  paneles: "/mi-panel",
  departamentos: "/mis-departamentos",
};

const STORAGE_KEY = "bh_view_mode";
const COOKIE_KEY = "bh_view_mode";
const COOKIE_MAX_AGE_DAYS = 365;
const DEFAULT_MODE: ViewMode = "paneles";

function writeCookie(value: ViewMode) {
  if (typeof document === "undefined") return;
  const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${COOKIE_KEY}=${value}; path=/; max-age=${maxAge}; samesite=lax`;
}

function readCookie(): ViewMode | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${COOKIE_KEY}=`));
  if (!match) return null;
  const raw = match.split("=")[1];
  if (raw === "paneles" || raw === "departamentos") return raw;
  return null;
}

interface ViewModeContextValue {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  dashboardPath: string;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

function readStoredMode(): ViewMode {
  if (typeof window === "undefined") return DEFAULT_MODE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "paneles" || raw === "departamentos") return raw;
  } catch {
    // ignore — fall back to cookie / default
  }
  const fromCookie = readCookie();
  if (fromCookie) return fromCookie;
  return DEFAULT_MODE;
}

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>(DEFAULT_MODE);

  useEffect(() => {
    setModeState(readStoredMode());
  }, []);

  const setMode = useCallback((next: ViewMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage may be unavailable (private mode, quota); ignore
    }
    writeCookie(next);
  }, []);

  const value = useMemo<ViewModeContextValue>(
    () => ({ mode, setMode, dashboardPath: VIEW_MODE_DASHBOARDS[mode] }),
    [mode, setMode],
  );

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

export function useViewMode(): ViewModeContextValue {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error("useViewMode must be used within ViewModeProvider");
  return ctx;
}

export function readStoredViewMode(): ViewMode {
  return readStoredMode();
}
