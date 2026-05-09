-- Migration 075: Productos.preparacion y productos.partida
-- Añade dos columnas a productos para organizar la producción de los productos de venta:
--   • preparacion: zona principal donde se prepara ("Barra" o "Cocina").
--   • partida:     zona específica dentro de esa preparación (texto libre,
--                  ej. "FRÍO + POSTRES", "FUEGOS + HORNOS", "COCKTELERÍA").
-- Aplica solo a productos de tipo "venta" desde la UI; a nivel de tabla las
-- columnas son nullables para no impactar al resto de tipos.

alter table public.productos
  add column if not exists preparacion text,
  add column if not exists partida text;

alter table public.productos
  drop constraint if exists productos_preparacion_check;

alter table public.productos
  add constraint productos_preparacion_check
  check (preparacion is null or preparacion in ('Barra', 'Cocina'));

comment on column public.productos.preparacion is
  'Zona principal donde se prepara el producto de venta: "Barra" o "Cocina".';
comment on column public.productos.partida is
  'Zona específica dentro de la preparación (ej: "FRÍO + POSTRES", "COCKTELERÍA").';
