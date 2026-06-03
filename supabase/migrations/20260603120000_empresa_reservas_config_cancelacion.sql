-- Configuración GLOBAL de la política de cancelación por empresa.
-- El texto explicativo que ve el cliente es FIJO (mismo para todas las
-- empresas; vive en código). Lo único editable por empresa es:
--   · horas mínimas para cancelar sin penalización (entero ≥ 1; horas completas)
--   · importe que se le cobra si no se presenta o cancela tarde (€ ≥ 1.00, 2 decimales)
-- Además, se puede activar un mensaje personalizado para añadir al correo
-- cuando se pide tarjeta de política de cancelación.

ALTER TABLE public.empresa_reservas_config
  ADD COLUMN IF NOT EXISTS cancelacion_horas_antes integer NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS cancelacion_importe_eur numeric(8,2) NOT NULL DEFAULT 10.00,
  ADD COLUMN IF NOT EXISTS cancelacion_personalizar_mensaje boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelacion_mensaje_personalizado text;

ALTER TABLE public.empresa_reservas_config
  DROP CONSTRAINT IF EXISTS empresa_reservas_config_cancelacion_horas_chk;
ALTER TABLE public.empresa_reservas_config
  ADD CONSTRAINT empresa_reservas_config_cancelacion_horas_chk
  CHECK (cancelacion_horas_antes BETWEEN 1 AND 168);

ALTER TABLE public.empresa_reservas_config
  DROP CONSTRAINT IF EXISTS empresa_reservas_config_cancelacion_importe_chk;
ALTER TABLE public.empresa_reservas_config
  ADD CONSTRAINT empresa_reservas_config_cancelacion_importe_chk
  CHECK (cancelacion_importe_eur >= 1.00 AND cancelacion_importe_eur <= 9999.99);

COMMENT ON COLUMN public.empresa_reservas_config.cancelacion_horas_antes IS
  'Horas mínimas de antelación con las que el cliente puede cancelar sin penalización (1–168, horas completas). Default 6.';
COMMENT ON COLUMN public.empresa_reservas_config.cancelacion_importe_eur IS
  'Importe (€) que se cobra al cliente si no se presenta o cancela con menos antelación que cancelacion_horas_antes. Mín 1.00, máx 2 decimales. Default 10.00.';
COMMENT ON COLUMN public.empresa_reservas_config.cancelacion_personalizar_mensaje IS
  'Si true, se añade cancelacion_mensaje_personalizado al correo que se envía al cliente cuando se pide tarjeta de política de cancelación.';
COMMENT ON COLUMN public.empresa_reservas_config.cancelacion_mensaje_personalizado IS
  'Texto libre que se añade al correo de confirmación cuando la reserva usa política de cancelación.';
