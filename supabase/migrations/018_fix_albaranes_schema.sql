-- ============================================================
-- 018_fix_albaranes_schema.sql
-- Adapta la tabla albaranes para soportar persistencia desde
-- PedidosView (que trabaja con proveedor_nombre, no UUID).
-- ============================================================

-- 1. Hacer proveedor_id nullable (tenemos proveedor_nombre)
ALTER TABLE public.albaranes
  ALTER COLUMN proveedor_id DROP NOT NULL;

-- 2. Añadir columnas que necesita PedidosView
ALTER TABLE public.albaranes
  ADD COLUMN IF NOT EXISTS proveedor_nombre text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS almacen          text NOT NULL DEFAULT 'COCINA',
  ADD COLUMN IF NOT EXISTS documento        text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS creador          text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS lineas           jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3. Índices útiles
CREATE INDEX IF NOT EXISTS idx_albaranes_pedido ON public.albaranes(pedido_id);
CREATE INDEX IF NOT EXISTS idx_albaranes_fecha  ON public.albaranes(empresa_id, fecha DESC);
