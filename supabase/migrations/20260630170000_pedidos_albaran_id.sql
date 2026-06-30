-- pedidos.albaran_id: puntero directo al albarán generado por el pedido.
--
-- El código lo da por hecho pero NINGUNA migración lo creó nunca:
--   · createAlbaran (albaranes-actions.ts) lo ESCRIBE: update pedidos set ..., albaran_id=...
--   · deleteAlbaran lo ESCRIBE: albaran_id=null
--   · PedidosView.tsx:90 lo LEE (row.albaran_id -> Pedido.albaranId) para mostrar el
--     albarán vinculado y bloquear el borrado del pedido.
-- Al no existir la columna, el update de createAlbaran fallaba entero y el pedido se
-- quedaba en "Enviado" (no pasaba a "Confirmado"). La relación inversa albaranes.pedido_id
-- ya existe; esto es el puntero directo (denormalizado) que el código usa. Idempotente.

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS albaran_id uuid
  REFERENCES public.albaranes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idxfk_pedidos_albaran_id ON public.pedidos (albaran_id);

-- Backfill: vincular los pedidos que ya tienen albarán (relación 1:1 en este modelo).
UPDATE public.pedidos p
SET    albaran_id = a.id
FROM   public.albaranes a
WHERE  a.pedido_id = p.id AND p.albaran_id IS NULL;
