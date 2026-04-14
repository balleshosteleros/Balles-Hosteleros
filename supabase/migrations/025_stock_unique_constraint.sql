-- ============================================================
-- 025_stock_unique_constraint.sql
-- Añade constraint UNIQUE en (empresa_id, producto_id) a la tabla
-- stock para evitar filas duplicadas.
--
-- Contexto: en el test de integridad Ágora (2026-04-14) se detectaron
-- 130 duplicados tras la inicialización con migration 024 porque no
-- existía ningún constraint que lo impidiera.
--
-- Este constraint permite hacer INSERT ... ON CONFLICT DO NOTHING
-- o UPSERT con onConflict: "empresa_id,producto_id" de forma segura.
-- ============================================================

-- Eliminar duplicados antes de añadir el constraint
-- (keep la fila con id menor en orden lexicográfico UUID)
DELETE FROM public.stock s1
USING public.stock s2
WHERE s1.empresa_id = s2.empresa_id
  AND s1.producto_id = s2.producto_id
  AND s1.id > s2.id;

-- Añadir unique constraint
ALTER TABLE public.stock
  ADD CONSTRAINT stock_empresa_producto_unique
  UNIQUE (empresa_id, producto_id);

-- Índice ya creado en migración 021 (idx_stock_producto_id)
-- No se duplica aquí.

COMMENT ON CONSTRAINT stock_empresa_producto_unique ON public.stock IS
  'Garantiza una sola fila de stock por producto y empresa. '
  'Añadido en migración 025 tras detectar duplicados en init de Ágora (2026-04-14).';
