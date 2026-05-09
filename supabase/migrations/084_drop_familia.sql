-- Migration 084: eliminación completa del concepto "familia" en productos
-- Decisión de producto: lo que antes era "familia" pasa a ser "categoria".
-- Cero datos perdidos: productos.familia estaba 100% NULL en producción.

-- 1. productos: drop columna familia
alter table public.productos drop column if exists familia;

-- 2. productos_config: limpiar filas legacy 'familias' y actualizar check
delete from public.productos_config where seccion = 'familias';

alter table public.productos_config drop constraint if exists productos_config_seccion_check;
alter table public.productos_config add constraint productos_config_seccion_check
  check (seccion = any (array['categorias'::text, 'estados'::text, 'umbral_coste'::text]));

-- 3. producto_taxonomia: la migración 006 nunca llegó a aplicarse en este
-- proyecto, pero limpiamos por si algún ambiente la corrió.
drop table if exists public.producto_taxonomia cascade;
drop type if exists public.producto_taxonomia_kind;
