-- ============================================================
-- 021_stock_backfill_producto_id.sql
-- La tabla stock ya tiene la columna producto_id (UUID FK a productos)
-- pero muchas filas tienen NULL porque el código antiguo solo usaba
-- producto_nombre como clave.
-- Esta migración:
--   1. Rellena producto_id cruzando por nombre (case-insensitive)
--   2. Asegura un índice en producto_id para búsquedas rápidas
-- ============================================================

-- Backfill: cruzar stock.producto_nombre con productos.nombre
-- stock.empresa_id es TEXT, productos.empresa_id es UUID → cast explícito
UPDATE public.stock s
SET producto_id = p.id
FROM public.productos p
WHERE s.producto_id IS NULL
  AND p.empresa_id::text = s.empresa_id
  AND LOWER(TRIM(s.producto_nombre)) = LOWER(TRIM(p.nombre));

-- Índice para búsquedas rápidas por producto_id
CREATE INDEX IF NOT EXISTS idx_stock_producto_id
  ON public.stock(producto_id)
  WHERE producto_id IS NOT NULL;

-- Índice compuesto empresa+nombre para fallback por nombre
CREATE INDEX IF NOT EXISTS idx_stock_empresa_nombre
  ON public.stock(empresa_id, LOWER(producto_nombre));
