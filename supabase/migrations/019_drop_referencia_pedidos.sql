-- ============================================================
-- 019_drop_referencia_pedidos.sql
-- Elimina la columna referencia de la tabla pedidos.
-- Esta columna se usaba como "Doc. Proveedor" pero se ha
-- decidido eliminar del flujo de trabajo.
-- ============================================================

alter table public.pedidos
  drop column if exists referencia;
