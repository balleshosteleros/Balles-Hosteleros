-- Plantillas de correo del módulo de Reservas por empresa.
--
-- Modelo: 6 tipos canónicos (ver CHECK abajo). Una fila por (empresa_id, tipo).
-- Los campos `asunto_personalizado` / `mensaje_personalizado` son NULL cuando la
-- empresa no ha tocado nada; en ese caso el mailer usa los textos de fábrica
-- definidos en `src/lib/seeds/reserva-email-plantillas.ts`.
--
-- Tipos:
--   CONFIRMACION      → al crear la reserva (estado inicial)
--   RECONFIRMACION    → X días antes (config en empresa_reservas_config)
--   RECORDATORIO      → X horas antes (config recordatorio_horas_antes)
--   CANCELACION       → al cambiar estado a CANCELADA
--   POLITICA_AVISO    → bloque añadido al correo de confirmación cuando
--                       reserva tiene tipo_categoria = 'politica'
--   CUPON_PAGADO      → bloque añadido al correo de confirmación cuando
--                       reserva tiene tipo_categoria = 'cupon'
--
-- Las plantillas POLITICA_AVISO y CUPON_PAGADO NO envían correo aparte: solo
-- aportan texto al de confirmación. Por eso la UI las muestra como "bloques".

CREATE TABLE IF NOT EXISTS public.reserva_email_plantillas (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id             uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo                   text NOT NULL,
  activa                 boolean NOT NULL DEFAULT true,
  asunto_personalizado   text,
  mensaje_personalizado  text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reserva_email_plantillas_tipo_chk CHECK (
    tipo IN ('CONFIRMACION','RECONFIRMACION','RECORDATORIO','CANCELACION','POLITICA_AVISO','CUPON_PAGADO')
  ),
  CONSTRAINT reserva_email_plantillas_unq UNIQUE (empresa_id, tipo)
);

CREATE INDEX IF NOT EXISTS reserva_email_plantillas_empresa_idx
  ON public.reserva_email_plantillas(empresa_id);

ALTER TABLE public.reserva_email_plantillas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reserva_email_plantillas_all ON public.reserva_email_plantillas;
CREATE POLICY reserva_email_plantillas_all ON public.reserva_email_plantillas
  FOR ALL
  USING (public.user_has_empresa_access(empresa_id))
  WITH CHECK (public.user_has_empresa_access(empresa_id));

COMMENT ON TABLE public.reserva_email_plantillas IS
  'Plantillas de correo del módulo Reservas por empresa (asunto + mensaje personalizado, todo NULL = texto de fábrica).';

-- ---------------------------------------------------------------------------
-- Columna nueva en empresa_reservas_config para el recordatorio (X horas antes).
-- Las demás configuraciones (cancelacion_*, reconfirmacion_*) ya existen.
-- ---------------------------------------------------------------------------
ALTER TABLE public.empresa_reservas_config
  ADD COLUMN IF NOT EXISTS recordatorio_activo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recordatorio_horas_antes integer NOT NULL DEFAULT 3;

ALTER TABLE public.empresa_reservas_config
  DROP CONSTRAINT IF EXISTS empresa_reservas_config_recordatorio_horas_chk;
ALTER TABLE public.empresa_reservas_config
  ADD CONSTRAINT empresa_reservas_config_recordatorio_horas_chk
  CHECK (recordatorio_horas_antes BETWEEN 1 AND 48);

COMMENT ON COLUMN public.empresa_reservas_config.recordatorio_activo IS
  'Si true, el cron de recordatorios envía un correo al cliente recordatorio_horas_antes de la reserva.';
COMMENT ON COLUMN public.empresa_reservas_config.recordatorio_horas_antes IS
  'Horas de antelación con las que se envía el correo de recordatorio (1–48). Default 3.';

-- ---------------------------------------------------------------------------
-- Auditoría: timestamps por tipo de correo enviado en `reservas`. Sirven para
-- (a) idempotencia (el cron no envía dos veces) y (b) trazabilidad.
-- ---------------------------------------------------------------------------
ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS email_confirmacion_at   timestamptz,
  ADD COLUMN IF NOT EXISTS email_reconfirmacion_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_recordatorio_at   timestamptz,
  ADD COLUMN IF NOT EXISTS email_cancelacion_at    timestamptz;

COMMENT ON COLUMN public.reservas.email_confirmacion_at IS
  'Timestamp del envío del correo de confirmación al cliente (null = no enviado).';
COMMENT ON COLUMN public.reservas.email_reconfirmacion_at IS
  'Timestamp del envío del correo de reconfirmación al cliente.';
COMMENT ON COLUMN public.reservas.email_recordatorio_at IS
  'Timestamp del envío del correo de recordatorio al cliente.';
COMMENT ON COLUMN public.reservas.email_cancelacion_at IS
  'Timestamp del envío del correo de cancelación al cliente.';

CREATE INDEX IF NOT EXISTS reservas_recordatorio_pendiente_idx
  ON public.reservas(empresa_id, fecha, hora)
  WHERE email_recordatorio_at IS NULL AND estado NOT IN ('CANCELADA','NO_SHOW','COMPLETADA','LIBERADA');

CREATE INDEX IF NOT EXISTS reservas_reconfirmacion_pendiente_idx
  ON public.reservas(empresa_id, fecha, hora)
  WHERE email_reconfirmacion_at IS NULL AND estado IN ('CONFIRMADA','PENDIENTE');
