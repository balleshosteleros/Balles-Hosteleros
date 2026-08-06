"use client";

import { CalidadClientesView } from "./CalidadClientesView";

/**
 * Vista de /calidad/resenas.
 *
 * Monta la vista con pestañas (Reseñas + Agentes IA) en lugar de solo el
 * pipeline: sin la pestaña de agentes no había forma de crearlos desde esta
 * ruta, y sin agentes la IA no genera ningún borrador.
 */
export function CalidadResenasView() {
  return <CalidadClientesView />;
}
