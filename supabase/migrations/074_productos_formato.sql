-- Migration 074: Productos.formato
-- Añade columna formato (texto libre) a productos.
-- Aplica a productos de compra y de elaboración. Las opciones disponibles
-- en UI dependen de la unidad elegida (definidas en data/productos.ts).

alter table public.productos
  add column if not exists formato text;

comment on column public.productos.formato is
  'Formato/presentación del producto (ej: "Caja 10 kg", "Botella 750 ml"). Las opciones disponibles dependen de unidad.';
