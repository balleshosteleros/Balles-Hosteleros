-- PRP-083 (Fase 1) — Monedero prepago de mensajería.
--
-- Cada empresa paga POR ADELANTADO los WhatsApp y SMS que envía: recarga
-- saldo, y cada mensaje lo descuenta. Sin saldo no sale nada — así el software
-- nunca adelanta dinero que luego no cobra.
--
-- El saldo es un CAMPO, no la suma de los movimientos: evita recalcular un
-- extracto entero en cada envío y, sobre todo, evita que dos envíos
-- simultáneos lean el mismo saldo y lo gasten dos veces.
--
-- Idempotente: se puede volver a ejecutar sin romper nada.

-- ═══════════════════════════════════════════════════════════════════
-- 1. Tarifas: lo que se le cobra a la empresa por mensaje
--
-- Es precio de VENTA, no coste. Va en tabla y no en el código para poder
-- cambiarlo sin desplegar, y con vigencia para no reescribir el pasado: un
-- movimiento antiguo tiene que seguir cuadrando con la tarifa de su día.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.mensajeria_tarifas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canal          TEXT NOT NULL CHECK (canal IN ('WHATSAPP', 'SMS')),
  -- En céntimos: el dinero nunca se guarda en decimales.
  precio_cents   INT  NOT NULL CHECK (precio_cents >= 0),
  vigente_desde  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS mensajeria_tarifas_canal_desde_uidx
  ON public.mensajeria_tarifas (canal, vigente_desde);

COMMENT ON TABLE public.mensajeria_tarifas IS
  'Precio de VENTA por mensaje. Con vigencia: cambiar la tarifa no reescribe movimientos pasados.';

ALTER TABLE public.mensajeria_tarifas ENABLE ROW LEVEL SECURITY;

-- La tarifa se lee desde el navegador (se muestra en el monedero) pero solo se
-- escribe desde el servidor: sin política de escritura, la RLS niega INSERT,
-- UPDATE y DELETE a todos salvo a service_role, que se la salta por diseño.
DROP POLICY IF EXISTS mensajeria_tarifas_select ON public.mensajeria_tarifas;
CREATE POLICY mensajeria_tarifas_select
  ON public.mensajeria_tarifas FOR SELECT TO authenticated
  USING (true);

-- Tarifas de partida (PRP-083 §5.5): números limpios, margen holgado sobre el
-- coste real (~3-4 c. el WhatsApp) y absorben subidas de Meta sin tocar nada.
INSERT INTO public.mensajeria_tarifas (canal, precio_cents, vigente_desde)
SELECT 'WHATSAPP', 5, CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM public.mensajeria_tarifas WHERE canal = 'WHATSAPP');

INSERT INTO public.mensajeria_tarifas (canal, precio_cents, vigente_desde)
SELECT 'SMS', 10, CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM public.mensajeria_tarifas WHERE canal = 'SMS');

-- Tarifa vigente de un canal a una fecha. La usan el orquestador de envío y la
-- pantalla del monedero, para que ambos digan el mismo precio.
CREATE OR REPLACE FUNCTION public.tarifa_mensajeria(
  p_canal TEXT,
  p_fecha DATE DEFAULT CURRENT_DATE
) RETURNS INT
LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $fn$
  SELECT precio_cents
    FROM public.mensajeria_tarifas
   WHERE canal = p_canal AND vigente_desde <= p_fecha
   ORDER BY vigente_desde DESC
   LIMIT 1;
$fn$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. El monedero: una fila por empresa
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.empresa_mensajeria_saldo (
  empresa_id  UUID PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,

  -- NUNCA negativo: la regla del prepago vive aquí, en la base de datos, no en
  -- el código. Un bug de la aplicación no puede dejar a una empresa a deber.
  saldo_cents INT NOT NULL DEFAULT 0 CHECK (saldo_cents >= 0),

  -- Marcas de aviso ya enviado: evitan repetir el mismo correo cada vez que se
  -- envía un mensaje con el saldo bajo. Se limpian al recargar.
  aviso_saldo_bajo_at TIMESTAMPTZ,
  aviso_saldo_cero_at TIMESTAMPTZ,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.empresa_mensajeria_saldo.saldo_cents IS
  'Saldo en céntimos. El CHECK >= 0 es la garantía del prepago.';

DROP TRIGGER IF EXISTS empresa_mensajeria_saldo_set_updated_at ON public.empresa_mensajeria_saldo;
CREATE TRIGGER empresa_mensajeria_saldo_set_updated_at
  BEFORE UPDATE ON public.empresa_mensajeria_saldo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.empresa_mensajeria_saldo ENABLE ROW LEVEL SECURITY;

-- Solo lectura para los usuarios de la empresa. El saldo SOLO se mueve por las
-- RPC de abajo: nadie puede regalarse saldo con un UPDATE.
DROP POLICY IF EXISTS empresa_mensajeria_saldo_select ON public.empresa_mensajeria_saldo;
CREATE POLICY empresa_mensajeria_saldo_select
  ON public.empresa_mensajeria_saldo FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT public.empresas_del_usuario()));

-- ═══════════════════════════════════════════════════════════════════
-- 3. El extracto: qué entró, qué salió y por qué
--
-- Solo se escribe, nunca se edita ni se borra: es la explicación de un saldo y
-- tiene que poder auditarse.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.empresa_mensajeria_movimientos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

  --   RECARGA    el restaurante mete dinero
  --   CONSUMO    un mensaje enviado
  --   DEVOLUCION un envío que falló y se reintegra
  --   AJUSTE     corrección manual desde admin (siempre con motivo)
  tipo TEXT NOT NULL CHECK (tipo IN ('RECARGA', 'CONSUMO', 'DEVOLUCION', 'AJUSTE')),

  -- Positivo suma, negativo resta. Nunca cero: un movimiento que no mueve nada
  -- no es un movimiento.
  importe_cents INT NOT NULL CHECK (importe_cents <> 0),

  -- Foto del saldo TRAS aplicar este movimiento. Permite auditar el extracto
  -- sin recalcular la cadena entera desde el principio.
  saldo_despues_cents INT NOT NULL CHECK (saldo_despues_cents >= 0),

  -- Qué fue esto, en cristiano: es lo que lee el restaurante en su extracto.
  concepto TEXT NOT NULL,

  -- El envío que lo generó, si lo hubo. Se rellena en la fase 2.
  mensaje_id UUID,

  -- Quién lo hizo. NULL si fue el sistema (un envío automático del cron).
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- El nombre, desnormalizado: un movimiento de dinero tiene que seguir
  -- diciendo quién lo hizo aunque ese usuario se borre después.
  usuario_nombre TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mensajeria_movimientos_empresa_fecha_idx
  ON public.empresa_mensajeria_movimientos (empresa_id, created_at DESC);

COMMENT ON TABLE public.empresa_mensajeria_movimientos IS
  'Extracto del monedero. Solo escritura: explica cómo se llegó al saldo actual.';

ALTER TABLE public.empresa_mensajeria_movimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mensajeria_movimientos_select ON public.empresa_mensajeria_movimientos;
CREATE POLICY mensajeria_movimientos_select
  ON public.empresa_mensajeria_movimientos FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT public.empresas_del_usuario()));

-- ═══════════════════════════════════════════════════════════════════
-- 4. Mover el saldo: las dos únicas puertas
--
-- Todo pasa por aquí, y aquí todo es atómico. El FOR UPDATE serializa los
-- envíos simultáneos: sin él, dos mensajes a la vez leen el mismo saldo y lo
-- gastan dos veces.
-- ═══════════════════════════════════════════════════════════════════

-- Suma saldo (recarga, devolución de un envío fallido, o ajuste manual).
CREATE OR REPLACE FUNCTION public.abonar_saldo_mensajeria(
  p_empresa_id UUID,
  p_importe_cents INT,
  p_tipo TEXT,
  p_concepto TEXT,
  p_usuario_id UUID DEFAULT NULL,
  p_usuario_nombre TEXT DEFAULT NULL,
  p_mensaje_id UUID DEFAULT NULL
) RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_saldo INT;
BEGIN
  IF p_importe_cents <= 0 THEN
    RAISE EXCEPTION 'IMPORTE_INVALIDO' USING ERRCODE = 'P0001';
  END IF;
  IF p_tipo NOT IN ('RECARGA', 'DEVOLUCION', 'AJUSTE') THEN
    RAISE EXCEPTION 'TIPO_INVALIDO' USING ERRCODE = 'P0001';
  END IF;

  -- Crea el monedero si la empresa aún no lo tenía: la primera recarga no
  -- debería exigir un alta previa.
  INSERT INTO public.empresa_mensajeria_saldo (empresa_id, saldo_cents)
  VALUES (p_empresa_id, 0)
  ON CONFLICT (empresa_id) DO NOTHING;

  UPDATE public.empresa_mensajeria_saldo
     SET saldo_cents = saldo_cents + p_importe_cents,
         -- Vuelve a haber dinero: los avisos de saldo bajo se rearman para que
         -- puedan volver a saltar la próxima vez.
         aviso_saldo_bajo_at = NULL,
         aviso_saldo_cero_at = NULL
   WHERE empresa_id = p_empresa_id
   RETURNING saldo_cents INTO v_saldo;

  INSERT INTO public.empresa_mensajeria_movimientos
    (empresa_id, tipo, importe_cents, saldo_despues_cents, concepto,
     usuario_id, usuario_nombre, mensaje_id)
  VALUES
    (p_empresa_id, p_tipo, p_importe_cents, v_saldo, p_concepto,
     p_usuario_id, p_usuario_nombre, p_mensaje_id);

  RETURN v_saldo;
END;
$fn$;

-- Resta saldo antes de enviar. Devuelve el saldo restante, o falla con
-- SIN_SALDO si no llega.
--
-- Se cobra ANTES de enviar y se devuelve si el envío falla. Al revés se puede
-- enviar sin cobrar, y eso es dinero perdido.
CREATE OR REPLACE FUNCTION public.consumir_saldo_mensajeria(
  p_empresa_id UUID,
  p_importe_cents INT,
  p_concepto TEXT,
  p_mensaje_id UUID DEFAULT NULL,
  p_usuario_id UUID DEFAULT NULL,
  p_usuario_nombre TEXT DEFAULT NULL
) RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_saldo INT;
BEGIN
  IF p_importe_cents <= 0 THEN
    RAISE EXCEPTION 'IMPORTE_INVALIDO' USING ERRCODE = 'P0001';
  END IF;

  -- Bloquea la fila hasta el final de la transacción: dos envíos a la vez se
  -- ponen en fila en lugar de gastar el mismo saldo dos veces.
  SELECT saldo_cents INTO v_saldo
    FROM public.empresa_mensajeria_saldo
   WHERE empresa_id = p_empresa_id
     FOR UPDATE;

  IF v_saldo IS NULL THEN
    RAISE EXCEPTION 'SIN_SALDO' USING ERRCODE = 'P0001';
  END IF;
  IF v_saldo < p_importe_cents THEN
    RAISE EXCEPTION 'SIN_SALDO' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.empresa_mensajeria_saldo
     SET saldo_cents = saldo_cents - p_importe_cents
   WHERE empresa_id = p_empresa_id
   RETURNING saldo_cents INTO v_saldo;

  INSERT INTO public.empresa_mensajeria_movimientos
    (empresa_id, tipo, importe_cents, saldo_despues_cents, concepto,
     usuario_id, usuario_nombre, mensaje_id)
  VALUES
    (p_empresa_id, 'CONSUMO', -p_importe_cents, v_saldo, p_concepto,
     p_usuario_id, p_usuario_nombre, p_mensaje_id);

  RETURN v_saldo;
END;
$fn$;

-- El saldo solo se mueve desde el servidor. Ningún navegador puede llamarlas.
REVOKE EXECUTE ON FUNCTION public.abonar_saldo_mensajeria(UUID, INT, TEXT, TEXT, UUID, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.abonar_saldo_mensajeria(UUID, INT, TEXT, TEXT, UUID, TEXT, UUID)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.consumir_saldo_mensajeria(UUID, INT, TEXT, UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.consumir_saldo_mensajeria(UUID, INT, TEXT, UUID, UUID, TEXT)
  TO service_role;
