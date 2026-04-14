-- ============================================================
-- 024_stock_init_ingredientes.sql
-- Inicializa una fila de stock (cantidad_actual = 0) para cada
-- producto de tipo 'compra' (ingredientes) que aún no tenga fila.
-- Necesario para que el descuento automático desde Ágora tenga
-- una fila donde decrementar cuando lleguen las primeras ventas.
-- ============================================================

INSERT INTO public.stock (
  empresa_id,
  producto_id,
  producto_nombre,
  cantidad_actual,
  unidad,
  ultimo_movimiento
)
SELECT
  p.empresa_id::text,
  p.id,
  p.nombre,
  0,
  COALESCE(p.unidad, 'ud'),
  NOW()
FROM public.productos p
WHERE p.tipo = 'compra'
  AND NOT EXISTS (
    SELECT 1 FROM public.stock s
    WHERE s.empresa_id = p.empresa_id::text
      AND s.producto_id = p.id
  );

-- Mensaje informativo
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.stock;
  RAISE NOTICE 'Total filas en stock tras migración: %', v_count;
END $$;
