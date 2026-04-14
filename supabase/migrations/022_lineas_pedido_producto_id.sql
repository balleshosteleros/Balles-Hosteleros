-- ============================================================
-- 022_lineas_pedido_producto_id.sql
-- Añade producto_id (FK a productos) a lineas_pedido.
-- Nullable para no romper filas existentes; el código de app
-- exige que esté informado al crear nuevas líneas.
-- ============================================================

ALTER TABLE public.lineas_pedido
  ADD COLUMN IF NOT EXISTS producto_id uuid REFERENCES public.productos(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_lineas_pedido_producto_id
  ON public.lineas_pedido(producto_id)
  WHERE producto_id IS NOT NULL;

-- Backfill: rellenar producto_id cruzando por nombre en los pedidos existentes
UPDATE public.lineas_pedido lp
SET producto_id = p.id
FROM public.productos p
WHERE lp.producto_id IS NULL
  AND LOWER(TRIM(lp.producto_nombre)) = LOWER(TRIM(p.nombre));
