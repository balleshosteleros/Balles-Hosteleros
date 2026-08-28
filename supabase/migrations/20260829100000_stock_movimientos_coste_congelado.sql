-- PRP-080 Fase 1: coste unitario y valor total en cada movimiento de almacén.
--
-- POR QUÉ CONGELADO: Iván pide ver, en el historial de cada producto, cuánto costó cada
-- entrada y salida. Ese dato NO puede calcularse al mirarlo: 2 botellas compradas a 5 €
-- valen 10 € para siempre, aunque el vino suba a 7 € el año que viene. Si se leyera el
-- precio de hoy, el histórico mentiría. Mismo criterio que ya se aplica al puesto de un
-- empleado (se copia, no se referencia) y al precio de compra.
--
-- `coste_unitario` va SIEMPRE en la unidad de stock, no en la del albarán. Es la trampa
-- de este cambio: un albarán trae "1 caja de 12 a 24 €", pero al almacén entran 12
-- unidades. El coste unitario correcto es 2 €, no 24. De ahí la división por la
-- equivalencia del formato en el backfill y en el RPC de confirmación.

ALTER TABLE public.stock_movimientos
  ADD COLUMN IF NOT EXISTS coste_unitario NUMERIC,
  ADD COLUMN IF NOT EXISTS valor_total    NUMERIC;

COMMENT ON COLUMN public.stock_movimientos.coste_unitario IS
  'Coste por UNIDAD DE STOCK en el momento del movimiento. Congelado: no se recalcula '
  'nunca. NULL = no se pudo saber (no es lo mismo que 0 = gratis).';
COMMENT ON COLUMN public.stock_movimientos.valor_total IS
  'cantidad × coste_unitario en el momento del movimiento. Congelado.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill de los movimientos existentes.
--
-- Hoy son 63, todos de albarán, así que su coste se recupera de las líneas del albarán
-- (`albaranes.lineas`, JSONB) cruzando por `origen_linea_id`. Para tipos sin documento de
-- compra detrás no hay coste retroactivo posible, y se quedan en NULL a propósito.
--
-- `equivalenciaAplicada` lo persiste el propio RPC de confirmación al recibir, así que la
-- conversión es exacta y no hay que adivinarla.
UPDATE public.stock_movimientos m
   SET coste_unitario = (l->>'precioUC')::numeric
                        / nullif(coalesce((l->>'equivalenciaAplicada')::numeric, 1), 0),
       valor_total    = (l->>'precioUC')::numeric * (l->>'cantidad')::numeric
  FROM public.albaranes a,
       LATERAL jsonb_array_elements(a.lineas) l
 WHERE m.documento_tipo = 'albaran'
   AND m.documento_id = a.id
   AND m.origen_linea_id IS NOT NULL
   AND l ? 'id'
   AND (l->>'id') ~ '^[0-9a-fA-F-]{36}$'
   AND m.origen_linea_id = (l->>'id')::uuid
   -- Precio 0 se queda en NULL: "no se sabe" y "gratis" no son lo mismo, y un albarán
   -- sin precios teclados es lo primero.
   AND coalesce(nullif(l->>'precioUC', '')::numeric, 0) > 0;
