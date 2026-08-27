-- PRP-081 (corrección) — Guardar el árbol de Drive en la importación.
-- Aplicada en producción el 2026-08-27. Idempotente.
--
-- La copia leía la unidad ENTERA en cada llamada. Con 12.172 archivos esa
-- lectura tarda más que la ventana de ejecución, así que el bucle salía por
-- tiempo antes de copiar el primer archivo y guardaba "0 copiados". La
-- siguiente llamada volvía a leerlo todo desde cero: nunca avanzaba, por
-- muchas vueltas que diera.
--
-- Ahora el árbol se lee UNA vez, se guarda aquí, y las llamadas siguientes lo
-- reutilizan y dedican toda su ventana a copiar.
alter table public.archivos_importaciones
  add column if not exists arbol jsonb;
