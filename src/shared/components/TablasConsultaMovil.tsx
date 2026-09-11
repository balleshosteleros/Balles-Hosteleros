"use client";

import { useEffect } from "react";
import { useIsMobile } from "@/shared/hooks/use-mobile";

/**
 * En el TELÉFONO, las tablas del software se leen como una ficha por fila.
 *
 * Una tabla de diez columnas no cabe en 390 px: se salía por la derecha y para
 * ver un dato había que arrastrar a ciegas, sin saber ya de qué columna era.
 * En móvil el software es de CONSULTA, así que cada fila se apila como una
 * tarjeta con "etiqueta → valor", y así se ve TODO sin mover nada.
 *
 * Quién se apila: solo las tablas marcadas con `data-tabla-consulta` (las de
 * listado). Los cuadrantes, calendarios y demás rejillas siguen como están,
 * porque ahí la cuadrícula ES la información.
 *
 * Este componente no pinta nada: recorre esas tablas y copia el título de cada
 * columna a su celda (`data-columna`), que es lo que el CSS enseña como
 * etiqueta. El apilado en sí lo hace `globals.css`. Se hace aquí, en un solo
 * sitio, y no repitiendo el rótulo en las 39 vistas que tienen listado.
 */
export function TablasConsultaMovil() {
  const esMovil = useIsMobile();

  useEffect(() => {
    if (!esMovil) return;

    function etiquetar() {
      const tablas = document.querySelectorAll<HTMLTableElement>(
        "table[data-tabla-consulta]",
      );
      for (const tabla of tablas) {
        const cabeceras = Array.from(
          tabla.querySelectorAll<HTMLTableCellElement>("thead > tr > th"),
        ).map((th) => (th.textContent ?? "").trim());
        if (cabeceras.length === 0) continue;

        const filas = tabla.querySelectorAll<HTMLTableRowElement>("tbody > tr");
        for (const fila of filas) {
          const celdas = fila.children;
          for (let i = 0; i < celdas.length; i++) {
            const celda = celdas[i] as HTMLTableCellElement;
            // Fila de "no hay resultados" (una celda que ocupa toda la tabla):
            // se deja tal cual, sin etiqueta.
            const ocupaTodo = celda.colSpan > 1;
            const rotulo = ocupaTodo ? "" : (cabeceras[i] ?? "");
            if (celda.dataset.columna !== rotulo) {
              celda.dataset.columna = rotulo;
            }
            // Una celda sin rótulo y sin contenido no pinta nada: se esconde
            // para que la ficha no tenga renglones en blanco.
            const vacia =
              !ocupaTodo &&
              (celda.textContent ?? "").trim() === "" &&
              celda.childElementCount === 0;
            if (vacia) celda.dataset.vacia = "";
            else delete celda.dataset.vacia;

            // La columna de acciones (la que no tiene título y solo lleva
            // botones: editar, borrar, el menú de los tres puntos) tampoco
            // sale: el teléfono es de consulta, se mira y ya está.
            const soloBotones =
              !ocupaTodo &&
              rotulo === "" &&
              celda.childElementCount > 0 &&
              celda.querySelector("button, a[role='button']") !== null &&
              (celda.textContent ?? "").trim().length <= 24;
            if (soloBotones) celda.dataset.acciones = "";
            else delete celda.dataset.acciones;
          }

          // La raya de separación sobra debajo del último renglón que SE VE.
          // Como las celdas ocultas (vacías y las de botones) suelen ser las
          // últimas, sin esto quedaba una rayita suelta al pie de la ficha.
          let ultima: HTMLElement | null = null;
          for (let i = 0; i < celdas.length; i++) {
            const celda = celdas[i] as HTMLTableCellElement;
            delete celda.dataset.ultima;
            if (celda.dataset.vacia === undefined && celda.dataset.acciones === undefined) {
              ultima = celda;
            }
          }
          if (ultima) ultima.dataset.ultima = "";
        }
      }
    }

    etiquetar();
    // Las listas se cargan y se filtran después de pintar, así que hay que
    // volver a etiquetar cuando cambian las filas. Se agrupa en el siguiente
    // repintado: un filtro que reescribe cien filas dispara cien avisos, y sin
    // agrupar se recorrería la tabla entera cien veces.
    let pendiente = 0;
    const observador = new MutationObserver(() => {
      if (pendiente) return;
      pendiente = window.requestAnimationFrame(() => {
        pendiente = 0;
        etiquetar();
      });
    });
    observador.observe(document.body, { childList: true, subtree: true });
    return () => {
      if (pendiente) window.cancelAnimationFrame(pendiente);
      observador.disconnect();
    };
  }, [esMovil]);

  return null;
}
