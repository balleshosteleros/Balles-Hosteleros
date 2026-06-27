-- IVA de los productos de venta.
--
-- Hasta ahora la columna `iva` no existía en `productos`: el selector de IVA del
-- formulario de venta no se persistía. El IVA de compra sigue viviendo en el
-- histórico `producto_precios_compra` (no se toca aquí).
--
-- 1) Añade la columna `iva` (texto, p.ej. '10%').
-- 2) Pone 10% por defecto a TODOS los productos de venta (tipo reducido de
--    hostelería). Solo rellena los que no tengan IVA, para no pisar overrides.
-- Idempotente.

alter table public.productos
  add column if not exists iva text;

update public.productos
  set iva = '10%'
  where tipo = 'venta'
    and (iva is null or iva = '');
