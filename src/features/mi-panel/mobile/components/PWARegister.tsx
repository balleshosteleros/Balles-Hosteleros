"use client";

import { useEffect } from "react";

// Registra el service worker /sw.js cuando estamos en producción o el flag local lo permite.
// En dev (NODE_ENV=development) NO se registra, para no cachear durante hot reload.
export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const allowInDev =
      typeof localStorage !== "undefined" && localStorage.getItem("bh_sw_dev") === "1";

    if (process.env.NODE_ENV !== "production" && !allowInDev) return;

    const register = () => {
      navigator.serviceWorker
        // updateViaCache 'none': el navegador no cachea sw.js, así detecta
        // cambios del worker sin servir una copia vieja.
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((reg) => {
          reg.update().catch(() => {});
        })
        .catch(() => {
          /* silencioso: el registro fallido no debe romper la app */
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);

  return null;
}
