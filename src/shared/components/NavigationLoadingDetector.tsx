"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useGlobalLoading } from "@/shared/stores/use-global-loading";

const POST_NAV_DELAY_MS = 600;
const SAFETY_TIMEOUT_MS = 8000;

/**
 * Detecta navegaciones internas (click en <a> / <Link>) y muestra el spinner
 * global hasta que pathname/searchParams cambian. Mantiene el overlay un
 * pequeño margen extra tras el cambio de ruta para cubrir el primer fetch
 * del componente recién montado.
 */
export function NavigationLoadingDetector() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const show = useGlobalLoading((s) => s.show);
  const hide = useGlobalLoading((s) => s.hide);
  const pendingRef = useRef(false);
  const safetyTimeoutRef = useRef<number | null>(null);
  const postNavTimeoutRef = useRef<number | null>(null);

  const clearPending = () => {
    if (pendingRef.current) {
      hide();
      pendingRef.current = false;
    }
    if (safetyTimeoutRef.current) {
      window.clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    if (postNavTimeoutRef.current) {
      window.clearTimeout(postNavTimeoutRef.current);
      postNavTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      if (anchor.target && anchor.target !== "" && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      const currentSearch = searchParams.toString();
      if (url.pathname === pathname && url.search.replace(/^\?/, "") === currentSearch) return;

      pendingRef.current = true;
      show();

      if (safetyTimeoutRef.current) window.clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = window.setTimeout(() => {
        clearPending();
      }, SAFETY_TIMEOUT_MS);
    };

    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [pathname, searchParams, show, hide]);

  useEffect(() => {
    if (!pendingRef.current) return;
    if (postNavTimeoutRef.current) window.clearTimeout(postNavTimeoutRef.current);
    postNavTimeoutRef.current = window.setTimeout(() => {
      clearPending();
    }, POST_NAV_DELAY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  useEffect(() => {
    return () => clearPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
