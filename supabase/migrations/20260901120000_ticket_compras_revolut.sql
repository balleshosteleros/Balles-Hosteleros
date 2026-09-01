-- PRP-078 — Reservas de Ticket: compra previa, código único y canje posterior.
--
-- Flujo: el cliente COMPRA un producto de tipo Ticket (con Revolut o gratis),
-- recibe un código de 6 caracteres de UN SOLO USO, y más adelante lo canjea en
-- el motor de reservas. Las condiciones de canje (días, horarios, turnos y
-- zonas) se configuran en el propio producto y el motor las respeta.
--
-- Idempotente: se puede volver a ejecutar sin romper nada.

-- ═══════════════════════════════════════════════════════════════════
-- 1. Cobro y condiciones de canje en el producto de Ticket
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.reserva_ticket_productos
  -- Cómo se cobra: 'revolut' (pasarela) o 'gratis' (no se cobra).
  ADD COLUMN IF NOT EXISTS cobro_modo TEXT NOT NULL DEFAULT 'revolut',
  -- Venta directa: si el producto se puede comprar desde la tienda pública.
  ADD COLUMN IF NOT EXISTS venta_publica BOOLEAN NOT NULL DEFAULT TRUE,
  -- Validez del código desde la compra. NULL = no caduca.
  ADD COLUMN IF NOT EXISTS validez_dias INT,
  -- Fecha límite fija para canjear. NULL = sin fecha límite.
  ADD COLUMN IF NOT EXISTS canje_hasta DATE,
  -- Condiciones de canje. Vacío/NULL = sin restricción en ese eje.
  --   dias_semana: ['lun','mar',...] días PERMITIDOS
  --   dias_excluidos: ['2026-12-24',...] fechas concretas NO permitidas
  --   turnos: ['COMIDA','CENA'] turnos PERMITIDOS
  --   hora_desde/hora_hasta: franja horaria permitida
  --   horas_excluidas: ['14:00','14:30'] horas concretas NO permitidas
  ADD COLUMN IF NOT EXISTS dias_semana TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dias_excluidos DATE[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS turnos TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hora_desde TEXT,
  ADD COLUMN IF NOT EXISTS hora_hasta TEXT,
  ADD COLUMN IF NOT EXISTS horas_excluidas TEXT[] NOT NULL DEFAULT '{}',
  -- Zonas comerciales (grupos_zonas) permitidas. Vacío = todas.
  ADD COLUMN IF NOT EXISTS grupo_zona_ids UUID[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ticket_producto_cobro_modo_chk'
  ) THEN
    ALTER TABLE public.reserva_ticket_productos
      ADD CONSTRAINT ticket_producto_cobro_modo_chk
      CHECK (cobro_modo IN ('revolut', 'gratis'));
  END IF;
END $$;

COMMENT ON COLUMN public.reserva_ticket_productos.cobro_modo IS
  'revolut = se cobra con la pasarela de Revolut; gratis = no se cobra.';
COMMENT ON COLUMN public.reserva_ticket_productos.dias_semana IS
  'Días de la semana PERMITIDOS para canjear. Vacío = todos.';
COMMENT ON COLUMN public.reserva_ticket_productos.grupo_zona_ids IS
  'Zonas comerciales permitidas para canjear. Vacío = todas.';

-- ═══════════════════════════════════════════════════════════════════
-- 2. Credenciales de Revolut por empresa (cifradas con AES-256-GCM)
--
-- Cada empresa cobra en SU cuenta de Revolut: el dinero de un restaurante
-- nunca puede entrar en la cuenta de otro.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.empresa_revolut_config (
  empresa_id        UUID PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  -- Clave secreta (sk_...) cifrada. NUNCA viaja al navegador.
  secret_key_cifrada TEXT,
  -- Clave pública (pk_...): puede ir al navegador, se guarda en claro.
  public_key         TEXT,
  -- Secreto de firma del webhook, cifrado.
  webhook_secret_cifrado TEXT,
  webhook_id         TEXT,
  entorno            TEXT NOT NULL DEFAULT 'produccion',
  activo             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT revolut_entorno_chk CHECK (entorno IN ('produccion', 'pruebas'))
);

COMMENT ON TABLE public.empresa_revolut_config IS
  'Credenciales de Revolut Merchant por empresa. Las claves secretas van cifradas.';

DROP TRIGGER IF EXISTS empresa_revolut_config_set_updated_at ON public.empresa_revolut_config;
CREATE TRIGGER empresa_revolut_config_set_updated_at
  BEFORE UPDATE ON public.empresa_revolut_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.empresa_revolut_config ENABLE ROW LEVEL SECURITY;

-- Solo lectura para usuarios de la empresa; la escritura va por service_role
-- desde las server actions (que ya comprueban permisos de Ajustes).
DROP POLICY IF EXISTS empresa_revolut_config_select ON public.empresa_revolut_config;
CREATE POLICY empresa_revolut_config_select
  ON public.empresa_revolut_config FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT public.empresas_del_usuario()));

-- ═══════════════════════════════════════════════════════════════════
-- 3. Compras de Ticket + código único de un solo uso
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.reserva_ticket_compras (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  producto_id        UUID NOT NULL REFERENCES public.reserva_ticket_productos(id) ON DELETE RESTRICT,

  -- Código promocional: 6 caracteres alfanuméricos, ÚNICO POR EMPRESA.
  codigo             TEXT NOT NULL CHECK (codigo ~ '^[A-Z0-9]{6}$'),

  -- Comprador (puede no ser todavía un cliente de la sala).
  comprador_nombre   TEXT NOT NULL,
  comprador_email    TEXT NOT NULL,
  comprador_telefono TEXT,

  -- Economía CONGELADA en el momento de la compra: aunque el producto cambie
  -- de precio después, esta compra mantiene lo que el cliente pagó.
  unidades           INT NOT NULL CHECK (unidades >= 1),
  precio_unitario    NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
  iva                NUMERIC(5,2) NOT NULL DEFAULT 0,
  importe_total      NUMERIC(10,2) NOT NULL CHECK (importe_total >= 0),
  moneda             TEXT NOT NULL DEFAULT 'EUR',

  -- Estado del ciclo de vida de la compra.
  --   pendiente = creada, esperando el pago
  --   pagada    = cobrada (o gratuita), código utilizable
  --   canjeada  = ya se usó para una reserva
  --   fallida / cancelada / caducada
  estado             TEXT NOT NULL DEFAULT 'pendiente',

  -- Pago (Revolut). Nulos cuando el producto es gratuito.
  cobro_modo         TEXT NOT NULL DEFAULT 'revolut',
  revolut_order_id   TEXT,
  revolut_estado     TEXT,
  pagado_at          TIMESTAMPTZ,

  -- Canje: una compra se canjea UNA sola vez.
  canje_hasta        DATE,
  reserva_id         UUID REFERENCES public.reservas(id) ON DELETE SET NULL,
  canjeado_at        TIMESTAMPTZ,

  email_compra_at    TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ticket_compra_codigo_unico UNIQUE (empresa_id, codigo),
  CONSTRAINT ticket_compra_estado_chk CHECK (
    estado IN ('pendiente', 'pagada', 'canjeada', 'fallida', 'cancelada', 'caducada')
  ),
  CONSTRAINT ticket_compra_cobro_modo_chk CHECK (cobro_modo IN ('revolut', 'gratis')),
  -- Una compra canjeada SIEMPRE apunta a su reserva y tiene fecha de canje.
  CONSTRAINT ticket_compra_canje_coherente CHECK (
    (estado = 'canjeada') = (reserva_id IS NOT NULL AND canjeado_at IS NOT NULL)
  )
);

COMMENT ON TABLE public.reserva_ticket_compras IS
  'Compras de productos de Ticket. Cada compra genera un código único de un solo uso.';
COMMENT ON COLUMN public.reserva_ticket_compras.importe_total IS
  'Importe realmente pagado, congelado. No se recalcula si el producto cambia de precio.';

CREATE INDEX IF NOT EXISTS ticket_compras_empresa_idx
  ON public.reserva_ticket_compras(empresa_id);
CREATE INDEX IF NOT EXISTS ticket_compras_codigo_idx
  ON public.reserva_ticket_compras(empresa_id, codigo);
CREATE INDEX IF NOT EXISTS ticket_compras_estado_idx
  ON public.reserva_ticket_compras(empresa_id, estado);
CREATE UNIQUE INDEX IF NOT EXISTS ticket_compras_revolut_order_idx
  ON public.reserva_ticket_compras(revolut_order_id)
  WHERE revolut_order_id IS NOT NULL;

DROP TRIGGER IF EXISTS ticket_compras_set_updated_at ON public.reserva_ticket_compras;
CREATE TRIGGER ticket_compras_set_updated_at
  BEFORE UPDATE ON public.reserva_ticket_compras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.reserva_ticket_compras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ticket_compras_select_empresa ON public.reserva_ticket_compras;
CREATE POLICY ticket_compras_select_empresa
  ON public.reserva_ticket_compras FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT public.empresas_del_usuario()));

-- ═══════════════════════════════════════════════════════════════════
-- 4. Vínculo de la reserva con su compra
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS ticket_compra_id UUID
    REFERENCES public.reserva_ticket_compras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ticket_codigo TEXT;

CREATE INDEX IF NOT EXISTS reservas_ticket_compra_idx
  ON public.reservas(ticket_compra_id) WHERE ticket_compra_id IS NOT NULL;

COMMENT ON COLUMN public.reservas.ticket_codigo IS
  'Código promocional canjeado. Congelado: no se puede editar a mano.';

-- ═══════════════════════════════════════════════════════════════════
-- 5. Generador de códigos únicos
--
-- Alfabeto sin caracteres ambiguos (0/O, 1/I) para que se puedan dictar por
-- teléfono y copiar de un correo sin errores.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.generar_codigo_ticket(p_empresa_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_alfabeto CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_codigo   TEXT;
  v_intento  INT := 0;
BEGIN
  LOOP
    v_codigo := '';
    FOR i IN 1..6 LOOP
      v_codigo := v_codigo || substr(v_alfabeto, floor(random() * length(v_alfabeto))::INT + 1, 1);
    END LOOP;

    -- Debe ser único frente a compras de ticket Y frente a cupones, para que
    -- el cliente nunca vea dos cosas distintas con el mismo código.
    IF NOT EXISTS (
      SELECT 1 FROM public.reserva_ticket_compras
       WHERE empresa_id = p_empresa_id AND codigo = v_codigo
    ) AND NOT EXISTS (
      SELECT 1 FROM public.reserva_codigos
       WHERE empresa_id = p_empresa_id AND codigo = v_codigo
    ) THEN
      RETURN v_codigo;
    END IF;

    v_intento := v_intento + 1;
    IF v_intento > 100 THEN
      RAISE EXCEPTION 'No se pudo generar un código único';
    END IF;
  END LOOP;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.generar_codigo_ticket(UUID) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.generar_codigo_ticket(UUID) TO service_role;

-- ═══════════════════════════════════════════════════════════════════
-- 6. Canje atómico: marca la compra como usada de forma irreversible
--
-- Es la pieza crítica del sistema. Bloquea la fila (FOR UPDATE) para que dos
-- reservas simultáneas con el mismo código no puedan canjearlo las dos.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.canjear_ticket_compra(
  p_compra_id  UUID,
  p_reserva_id UUID
) RETURNS public.reserva_ticket_compras
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_row public.reserva_ticket_compras;
BEGIN
  SELECT * INTO v_row FROM public.reserva_ticket_compras
   WHERE id = p_compra_id FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'NO_EXISTE' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.estado = 'canjeada' THEN
    RAISE EXCEPTION 'YA_UTILIZADO' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.estado <> 'pagada' THEN
    RAISE EXCEPTION 'NO_PAGADO' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.canje_hasta IS NOT NULL AND v_row.canje_hasta < CURRENT_DATE THEN
    RAISE EXCEPTION 'CADUCADO' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.reserva_ticket_compras
     SET estado      = 'canjeada',
         reserva_id  = p_reserva_id,
         canjeado_at = NOW(),
         updated_at  = NOW()
   WHERE id = p_compra_id
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.canjear_ticket_compra(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.canjear_ticket_compra(UUID, UUID) TO service_role;

-- ═══════════════════════════════════════════════════════════════════
-- 7. Blindaje: los datos del ticket no se editan a mano
--
-- Una vez la reserva nace de un canje, ni el tipo de reserva ni el código ni
-- el dinero se pueden cambiar desde la aplicación. Se protege en la BD para
-- que no dependa de que la interfaz se acuerde de bloquearlo.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.reservas_ticket_inmutable()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF OLD.ticket_compra_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.ticket_compra_id IS DISTINCT FROM OLD.ticket_compra_id
     OR NEW.ticket_codigo    IS DISTINCT FROM OLD.ticket_codigo
     OR NEW.ticket_producto_id IS DISTINCT FROM OLD.ticket_producto_id
     OR NEW.ticket_importe   IS DISTINCT FROM OLD.ticket_importe
     OR NEW.ticket_unidades  IS DISTINCT FROM OLD.ticket_unidades
     OR NEW.ticket_iva       IS DISTINCT FROM OLD.ticket_iva
     OR NEW.es_ticket        IS DISTINCT FROM OLD.es_ticket
     OR NEW.tipo_categoria   IS DISTINCT FROM OLD.tipo_categoria
  THEN
    RAISE EXCEPTION 'Los datos del ticket de una reserva canjeada no se pueden modificar'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS reservas_ticket_inmutable_trg ON public.reservas;
CREATE TRIGGER reservas_ticket_inmutable_trg
  BEFORE UPDATE ON public.reservas
  FOR EACH ROW EXECUTE FUNCTION public.reservas_ticket_inmutable();

-- ═══════════════════════════════════════════════════════════════════
-- 8. Nuevos tipos de correo: compra de Ticket y reserva con Ticket
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.reserva_email_plantillas
  DROP CONSTRAINT IF EXISTS reserva_email_plantillas_tipo_chk;
ALTER TABLE public.reserva_email_plantillas
  ADD CONSTRAINT reserva_email_plantillas_tipo_chk CHECK (tipo IN (
    'CONFIRMACION', 'RECONFIRMACION', 'RECORDATORIO', 'CANCELACION',
    'POLITICA_AVISO', 'CUPON_PAGADO', 'SOLICITUD_VALORACION',
    'TICKET_COMPRA', 'TICKET_RESERVA'
  ));

ALTER TABLE public.reserva_email_envios
  DROP CONSTRAINT IF EXISTS reserva_email_envios_tipo_chk;
ALTER TABLE public.reserva_email_envios
  ADD CONSTRAINT reserva_email_envios_tipo_chk CHECK (tipo IN (
    'CONFIRMACION', 'RECONFIRMACION', 'RECORDATORIO', 'CANCELACION',
    'POLITICA_AVISO', 'CUPON_PAGADO', 'SOLICITUD_VALORACION',
    'TICKET_COMPRA', 'TICKET_RESERVA'
  ));

-- Auditoría del correo de confirmación de reserva con ticket.
ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS email_ticket_reserva_at TIMESTAMPTZ;
