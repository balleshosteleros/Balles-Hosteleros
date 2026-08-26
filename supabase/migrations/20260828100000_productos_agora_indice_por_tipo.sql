-- Alinear el índice único de `productos.agora_id` con el que ya existe en producción.
--
-- PROBLEMA: la migración 011 lo declaró sobre (empresa_id, agora_id), pero producción lo
-- tiene sobre (empresa_id, agora_id, TIPO). No es un detalle: el modelo de negocio necesita
-- DOS fichas con el mismo agora_id —la de compra, que lleva el stock, y la de venta, que ve
-- el TPV— enlazadas por escandallo. Hoy hay 197 pares así en producción.
--
-- CONSECUENCIA DE NO ARREGLARLO: cualquier entorno recreado desde las migraciones (uno
-- nuevo, un preview, un restore) rechazaría la segunda ficha, y el importador de catálogo
-- fallaría al crear pares de bebida solo fuera de producción — el peor sitio para descubrirlo.
--
-- En producción es un no-op: el índice ya tiene esta forma.

DROP INDEX IF EXISTS idx_productos_agora;
CREATE UNIQUE INDEX IF NOT EXISTS idx_productos_agora
  ON public.productos (empresa_id, agora_id, tipo)
  WHERE agora_id IS NOT NULL;
