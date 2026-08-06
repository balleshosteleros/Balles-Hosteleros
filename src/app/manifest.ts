import type { MetadataRoute } from "next";

// PWA manifest para la app móvil Balles-Hosteleros.
// Solo afecta a la PWA — desktop sigue sin cambios.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Balles Hosteleros · Mi Panel",
    // `short_name` es lo que sale bajo el icono en la pantalla de inicio y lo que
    // el móvil propone en el campo editable al añadirla. Nombre COMPLETO a
    // propósito (Iván, 06-ago): antes decía solo "Balles". Si no cabe, el sistema
    // lo recorta al pintarlo, pero el nombre que se guarda y el que se busca es
    // este entero.
    short_name: "Balles Hosteleros",
    description: "Portal del empleado: fichar, turnos, comunicados y solicitudes.",
    // El icono de la pantalla de inicio abre SIEMPRE por aquí. `?app=1` marca que
    // viene del arranque de la PWA (no de una navegación normal), para que la
    // guardia de sesión pueda distinguirlo y mandar al login sin rebotar.
    //
    // Sin esa marca, abrir la app tras cerrar sesión entraba en bucle: "/m" exige
    // sesión y manda a "/", y la regla móvil de `next.config.ts` devuelve "/" a
    // "/m". El navegador se quedaba dando vueltas.
    start_url: "/m?app=1",
    // `id` fija la identidad de la PWA. Sin él, cambiar `start_url` haría que el
    // navegador la trate como una app distinta y quedaran dos iconos instalados.
    id: "/m",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0a0a0a",
    lang: "es-ES",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
