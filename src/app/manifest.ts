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
    // Azul del propio isotipo, NO blanco. Al instalar la app en escritorio
    // (Dock del Mac, Chrome "Instalar"), el sistema pinta el icono sobre un
    // lienzo de este color y luego lo redondea: en blanco salía un marco
    // alrededor del icono azul y el dibujo parecía recortado (Iván, 29-ago).
    // También es el color de la pantalla de arranque de la PWA.
    background_color: "#0a4f7a",
    theme_color: "#0a0a0a",
    lang: "es-ES",
    categories: ["business", "productivity"],
    // `?v=` al final de cada icono: al cambiar el dibujo hay que SUBIR ESE
    // NÚMERO. Para el móvil la dirección pasa a ser otra, así que se baja el
    // icono nuevo en vez de reutilizar el que tiene guardado, y la pantalla de
    // inicio se actualiza sola en unos días sin que nadie reinstale nada
    // (Iván, 29-ago: "ninguna app te dice desinstala y vuélvela a instalar").
    //
    // Solo Android e escritorio lo aprovechan. iOS congela el icono al añadir
    // la app a la pantalla de inicio y no vuelve a mirarlo nunca: ahí no hay
    // forma de refrescarlo, es una limitación de Apple.
    icons: [
      {
        src: "/icons/icon-192.png?v=2",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png?v=2",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.png?v=2",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
