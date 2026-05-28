import type { MetadataRoute } from "next";

// PWA manifest para la app móvil Balles-Hosteleros.
// Solo afecta a la PWA — desktop sigue sin cambios.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Balles Hosteleros · Mi Panel",
    short_name: "Balles",
    description: "Portal del empleado: fichar, turnos, comunicados y solicitudes.",
    start_url: "/m",
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
        sizes: "384x384",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
