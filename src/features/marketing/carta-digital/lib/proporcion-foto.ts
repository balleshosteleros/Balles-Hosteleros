/**
 * Proporción con la que hay que enseñar la foto de un plato.
 *
 * El hueco era 4:3 fijo y ese era el problema de raíz: una foto de cóctel es
 * vertical y meterla en un hueco horizontal corta la copa siempre —al Desliz
 * de cobra le cortaba la cobra entera y solo quedaba el vaso—. Rellenar los
 * lados tampoco valía: dejaba la foto como un recuadro dentro de otro.
 *
 * Ahora manda la foto: al recortarla se guarda su proporción en el nombre del
 * archivo (`-r75` = 0,75) y aquí se lee. Va en el nombre y no en una columna
 * nueva porque la foto y su proporción son el mismo dato: si cambia la foto,
 * cambia el nombre, y nunca pueden quedar descuadrados.
 *
 * Las fotos antiguas no llevan marca y siguen en 4:3, que es como se
 * guardaron.
 */
export const PROPORCION_POR_DEFECTO = 4 / 3;

export function proporcionFoto(url: string | null | undefined): number {
  if (!url) return PROPORCION_POR_DEFECTO;
  const m = /-r(\d{2,3})\.(?:jpg|jpeg|png|webp)$/i.exec(url);
  if (!m) return PROPORCION_POR_DEFECTO;
  const r = Number(m[1]) / 100;
  // Fuera de rango solo puede ser un nombre raro: mejor el marco de siempre
  // que una tarjeta de proporción absurda que descuadre la rejilla.
  return r >= 0.5 && r <= 2 ? r : PROPORCION_POR_DEFECTO;
}
