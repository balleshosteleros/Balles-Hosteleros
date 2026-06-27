-- Estados de documentos de logística simplificados (vocabulario compartido).
-- De 17 estados a un patrón común: editable → Confirmado (🔒, tiene un hijo en la cadena).
-- No hay "Anulado": si algo está mal se borra y el documento anterior retrocede un puesto.
--
--   Pedido:  Pendiente → Enviado   → Confirmado   (tiene albarán)
--   Albarán: Pendiente → Entregado → Confirmado   (tiene factura)
--   Factura: Pendiente → Confirmada                (contabilizada)
--
-- Idempotente: se puede reaplicar sin error. Guardado por existencia de tabla.

-- ─── PEDIDOS ──────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.pedidos') IS NOT NULL THEN
    -- Marca de envío al proveedor por correo. "Enviado" = se ha enviado el email.
    -- Permite que, al borrar el albarán, el pedido retroceda a "Enviado" solo si se envió.
    ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS enviado_at timestamptz;
    ALTER TABLE public.pedidos ALTER COLUMN estado DROP DEFAULT;
    -- Normalizar a text por si la columna fuese un ENUM (pedido_estado).
    ALTER TABLE public.pedidos ALTER COLUMN estado TYPE text USING estado::text;
    UPDATE public.pedidos SET estado = CASE estado
      WHEN 'Enviado'    THEN 'Enviado'
      WHEN 'Confirmado' THEN 'Confirmado'
      WHEN 'Servido'    THEN 'Confirmado'
      WHEN 'Archivado'  THEN 'Confirmado'
      ELSE 'Pendiente'   -- Borrador, Pendiente, Cancelado y cualquier otro
    END;
    ALTER TABLE public.pedidos ALTER COLUMN estado SET DEFAULT 'Pendiente';
    ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_check;
    ALTER TABLE public.pedidos
      ADD CONSTRAINT pedidos_estado_check
      CHECK (estado IN ('Pendiente','Enviado','Confirmado'));
  END IF;
END $$;

-- ─── ALBARANES ────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.albaranes') IS NOT NULL THEN
    ALTER TABLE public.albaranes DROP CONSTRAINT IF EXISTS albaranes_estado_check;
    ALTER TABLE public.albaranes ALTER COLUMN estado DROP DEFAULT;
    ALTER TABLE public.albaranes ALTER COLUMN estado TYPE text USING estado::text;
    UPDATE public.albaranes SET estado = CASE estado
      WHEN 'Pendiente' THEN 'Pendiente'
      WHEN 'Facturado' THEN 'Confirmado'
      WHEN 'Archivado' THEN 'Confirmado'
      ELSE 'Entregado'  -- Confirmado (antiguo) y Recibido = mercancía recepcionada
    END;
    ALTER TABLE public.albaranes ALTER COLUMN estado SET DEFAULT 'Pendiente';
    ALTER TABLE public.albaranes
      ADD CONSTRAINT albaranes_estado_check
      CHECK (estado IN ('Pendiente','Entregado','Confirmado'));
  END IF;
END $$;

-- ─── FACTURAS DE PROVEEDOR ────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.facturas_proveedor') IS NOT NULL THEN
    ALTER TABLE public.facturas_proveedor DROP CONSTRAINT IF EXISTS facturas_proveedor_estado_check;
    ALTER TABLE public.facturas_proveedor ALTER COLUMN estado DROP DEFAULT;
    ALTER TABLE public.facturas_proveedor ALTER COLUMN estado TYPE text USING estado::text;
    UPDATE public.facturas_proveedor SET estado = CASE estado
      WHEN 'Validada' THEN 'Confirmada'
      ELSE 'Pendiente'  -- Borrador, Analizada, ConDiscrepancias, Anulada
    END;
    ALTER TABLE public.facturas_proveedor ALTER COLUMN estado SET DEFAULT 'Pendiente';
    ALTER TABLE public.facturas_proveedor
      ADD CONSTRAINT facturas_proveedor_estado_check
      CHECK (estado IN ('Pendiente','Confirmada'));
  END IF;
END $$;
