-- ============================================================
-- 20260910130000_material_observaciones.sql
-- Un campo de observaciones en cada movimiento del almacén.
--
-- Decisión de Iván (10-09-2026): en los formularios del almacén **todos los
-- campos son obligatorios menos las observaciones**, que siempre están ahí por
-- si hay algo que apuntar.
--
-- POR QUÉ NO REUTILIZAR `motivo`
--   `motivo` es obligatorio en las bajas, las pérdidas y los ajustes, y es lo
--   que explica POR QUÉ desapareció una pieza. Las observaciones son otra cosa:
--   opcionales, en cualquier movimiento, y para lo que no cabe en ningún campo
--   ("venían con la etiqueta mal", "las trajo el repartidor nuevo"). Mezclarlas
--   haría que el motivo de una pérdida se confundiera con una nota suelta.
--
-- Idempotente.
-- ============================================================

alter table public.material_movimientos
  add column if not exists observaciones text;

comment on column public.material_movimientos.observaciones is
  'Texto libre opcional, en cualquier movimiento. Distinto de `motivo`, que es obligatorio en bajas, pérdidas y ajustes y explica por qué desapareció la pieza.';
