"use client";

import { useEffect, useRef } from "react";

/**
 * Auto-actualizador de la PWA. En iOS la app instalada NO se recarga al
 * reabrirla (resucita el snapshot congelado), así que nunca veía los deploys
 * nuevos. Este componente compara la versión horneada en el bundle
 * (NEXT_PUBLIC_BUILD_SHA) contra la desplegada (/api/version) al abrir la app,
 * al volver a ella y cada pocos minutos; si difieren, recarga una sola vez.
 *
 * Sin UI: devuelve null.
 */
const BAKED = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";
const CHECK_MS = 4 * 60 * 1000; // re-chequeo periódico mientras está abierta
const RELOADED_KEY = "bh_reloaded_for_sha";

export function VersionAutoUpdate() {
  const comprobando = useRef(false);

  useEffect(() => {
    // En desarrollo (o si no hay SHA horneada) no auto-recargamos.
    if (!BAKED || BAKED === "dev") return;

    const comprobar = async () => {
      if (comprobando.current || document.visibilityState !== "visible") return;
      comprobando.current = true;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { sha } = (await res.json()) as { sha?: string };
        if (!sha || sha === "dev" || sha === BAKED) return;

        // Anti-bucle: si ya recargamos por este mismo SHA y el bundle sigue
        // sin coincidir (propagación de CDN en curso), no recargamos otra vez.
        let yaIntentado: string | null = null;
        try {
          yaIntentado = sessionStorage.getItem(RELOADED_KEY);
        } catch {
          /* noop */
        }
        if (yaIntentado === sha) return;

        try {
          sessionStorage.setItem(RELOADED_KEY, sha);
        } catch {
          /* noop */
        }
        window.location.reload();
      } catch {
        /* sin red: lo reintentamos en el próximo ciclo */
      } finally {
        comprobando.current = false;
      }
    };

    // Al montar, al volver a primer plano y de forma periódica.
    void comprobar();
    const onVisible = () => {
      if (document.visibilityState === "visible") void comprobar();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const id = window.setInterval(comprobar, CHECK_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.clearInterval(id);
    };
  }, []);

  return null;
}
