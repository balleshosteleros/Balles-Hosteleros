-- Permitir sección 'iva_default' en productos_config.
-- Guarda el IVA por defecto (un único código, p.ej. '21%') por tipo de producto:
--   tipo='compra'  → IVA por defecto de los productos de compra
--   tipo='venta'   → IVA por defecto de los productos de venta
-- valores = ['21%']. Idempotente.

alter table public.productos_config
  drop constraint if exists productos_config_seccion_check;

alter table public.productos_config
  add constraint productos_config_seccion_check
  check (seccion in ('categorias', 'familias', 'estados', 'umbral_coste', 'iva_default'));
