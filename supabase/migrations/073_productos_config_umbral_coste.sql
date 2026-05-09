-- 073. Permitir sección 'umbral_coste' en productos_config
-- Almacena los umbrales (verde / naranja) del % de food cost para productos de venta.

alter table public.productos_config
  drop constraint if exists productos_config_seccion_check;

alter table public.productos_config
  add constraint productos_config_seccion_check
  check (seccion in ('categorias', 'familias', 'estados', 'umbral_coste'));
