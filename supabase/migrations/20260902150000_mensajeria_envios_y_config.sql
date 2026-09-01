-- PRP-083 (Fase 2) — Motor de envío: configuración por empresa y registro de
-- lo enviado por WhatsApp y SMS.
--
-- Idempotente: se puede volver a ejecutar sin romper nada.

-- ═══════════════════════════════════════════════════════════════════
-- 1. Configuración de mensajería por empresa
--
-- Las credenciales van CIFRADAS y nunca viajan al navegador, igual que las de
-- Revolut: un token de Twilio filtrado permite enviar mensajes a cuenta de la
-- empresa.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.empresa_mensajeria_config (
  empresa_id UUID PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,

  -- Subcuenta del proveedor. Cada empresa tiene la suya para poder ver su
  -- gasto por separado y suspenderla sin tocar a las demás.
  proveedor_subcuenta_id  TEXT,
  proveedor_token_cifrado TEXT,

  -- El número desde el que sale el WhatsApp, en formato internacional (+34…).
  whatsapp_numero    TEXT,
  whatsapp_sender_id TEXT,
  -- El número desde el que salen los SMS. Puede ser distinto del de WhatsApp.
  sms_numero         TEXT,

  --   SIN_CONECTAR           todavía no se ha dado de alta
  --   PENDIENTE_VERIFICACION Meta aún no ha verificado la empresa (límite bajo)
  --   ACTIVO                 funcionando
  --   SUSPENDIDO             Meta o nosotros lo hemos parado
  estado_alta TEXT NOT NULL DEFAULT 'SIN_CONECTAR'
    CHECK (estado_alta IN ('SIN_CONECTAR','PENDIENTE_VERIFICACION','ACTIVO','SUSPENDIDO')),

  -- Interruptores maestros de cada canal.
  whatsapp_activo BOOLEAN NOT NULL DEFAULT FALSE,
  sms_activo      BOOLEAN NOT NULL DEFAULT FALSE,

  -- Si el SMS entra cuando el WhatsApp no se puede entregar. Cuesta el doble,
  -- así que es decisión de la empresa.
  sms_respaldo_activo BOOLEAN NOT NULL DEFAULT TRUE,

  -- Qué avisos salen por WhatsApp. Se guarda como objeto para poder añadir
  -- tipos nuevos sin migrar la tabla otra vez.
  --   {"CONFIRMACION":true,"RECONFIRMACION":true,"RECORDATORIO":true,"CANCELACION":true}
  avisos_activos JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Tope de gasto mensual en céntimos. NULL = sin tope. Es el segundo freno
  -- después del saldo: protege de una campaña disparada por error.
  tope_mensual_cents INT CHECK (tope_mensual_cents IS NULL OR tope_mensual_cents >= 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.empresa_mensajeria_config.proveedor_token_cifrado IS
  'Token del proveedor, cifrado. NUNCA viaja al navegador.';
COMMENT ON COLUMN public.empresa_mensajeria_config.avisos_activos IS
  'Qué tipos de aviso salen por WhatsApp. Objeto para añadir tipos sin migrar.';

DROP TRIGGER IF EXISTS empresa_mensajeria_config_set_updated_at ON public.empresa_mensajeria_config;
CREATE TRIGGER empresa_mensajeria_config_set_updated_at
  BEFORE UPDATE ON public.empresa_mensajeria_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.empresa_mensajeria_config ENABLE ROW LEVEL SECURITY;

-- Solo lectura: la escritura va por server actions, que comprueban permisos.
-- Aun así el token cifrado nunca se selecciona desde el navegador.
DROP POLICY IF EXISTS empresa_mensajeria_config_select ON public.empresa_mensajeria_config;
CREATE POLICY empresa_mensajeria_config_select
  ON public.empresa_mensajeria_config FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT public.empresas_del_usuario()));

-- ═══════════════════════════════════════════════════════════════════
-- 2. Registro de envíos
--
-- Hermano de `reserva_email_envios`: qué salió, por dónde, a quién, cuánto
-- costó y si llegó. Es lo que ve el restaurante en la ficha de la reserva y lo
-- que explica cada consumo del monedero.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.mensajeria_envios (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

  -- Nulo en las campañas: no cuelgan de ninguna reserva.
  reserva_id UUID REFERENCES public.reservas(id) ON DELETE SET NULL,

  canal TEXT NOT NULL CHECK (canal IN ('WHATSAPP','SMS')),
  tipo  TEXT NOT NULL CHECK (tipo IN
    ('CONFIRMACION','RECONFIRMACION','RECORDATORIO','CANCELACION','CAMPANA')),

  -- Teléfono en formato internacional E.164 (+34…): es lo que exige el
  -- proveedor y evita ambigüedad entre países.
  destinatario TEXT NOT NULL,

  --   PENDIENTE  aceptado por el proveedor, sin confirmar
  --   ENVIADO    salió
  --   ENTREGADO  llegó al teléfono
  --   LEIDO      el cliente lo abrió (solo WhatsApp)
  --   FALLIDO    no se pudo entregar
  estado TEXT NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estado IN ('PENDIENTE','ENVIADO','ENTREGADO','LEIDO','FALLIDO')),

  -- Identificador del proveedor: la única forma de casar su webhook con esta
  -- fila cuando avisa del cambio de estado.
  proveedor_mensaje_id TEXT,
  error_codigo         TEXT,
  error_mensaje        TEXT,

  -- Lo cobrado del monedero. Cero si no llegó a cobrarse.
  coste_cents INT NOT NULL DEFAULT 0 CHECK (coste_cents >= 0),

  -- Mismos orígenes que el histórico de correos: una reserva llegada desde
  -- Google tiene que constar como tal también aquí.
  origen TEXT NOT NULL DEFAULT 'AUTOMATICO'
    CHECK (origen IN ('MANUAL','AUTOMATICO','PORTAL_PUBLICO','GOOGLE_RWG')),

  usuario_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_nombre TEXT,

  enviado_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mensajeria_envios_reserva_idx
  ON public.mensajeria_envios (reserva_id, enviado_at DESC);
CREATE INDEX IF NOT EXISTS mensajeria_envios_empresa_fecha_idx
  ON public.mensajeria_envios (empresa_id, enviado_at DESC);
-- El webhook del proveedor busca por SU identificador: sin índice, cada aviso
-- de entrega recorrería la tabla entera.
CREATE INDEX IF NOT EXISTS mensajeria_envios_proveedor_id_idx
  ON public.mensajeria_envios (proveedor_mensaje_id)
  WHERE proveedor_mensaje_id IS NOT NULL;

COMMENT ON TABLE public.mensajeria_envios IS
  'Qué se envió por WhatsApp o SMS: destinatario, estado de entrega y coste.';

ALTER TABLE public.mensajeria_envios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mensajeria_envios_select ON public.mensajeria_envios;
CREATE POLICY mensajeria_envios_select
  ON public.mensajeria_envios FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT public.empresas_del_usuario()));

-- El extracto del monedero apunta al envío que lo generó. La FK se añade ahora
-- que la tabla existe: un consumo tiene que poder explicarse.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mensajeria_movimientos_mensaje_fk'
  ) THEN
    ALTER TABLE public.empresa_mensajeria_movimientos
      ADD CONSTRAINT mensajeria_movimientos_mensaje_fk
      FOREIGN KEY (mensaje_id) REFERENCES public.mensajeria_envios(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Gasto del mes en curso
--
-- Para el tope mensual. Se calcula sobre los envíos y no sobre el extracto
-- porque el extracto también recoge recargas y ajustes, que no son gasto.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.gasto_mensajeria_mes(
  p_empresa_id UUID,
  p_fecha DATE DEFAULT CURRENT_DATE
) RETURNS INT
LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $fn$
  SELECT COALESCE(SUM(coste_cents), 0)::INT
    FROM public.mensajeria_envios
   WHERE empresa_id = p_empresa_id
     AND enviado_at >= date_trunc('month', p_fecha::timestamptz)
     AND enviado_at <  date_trunc('month', p_fecha::timestamptz) + INTERVAL '1 month';
$fn$;
