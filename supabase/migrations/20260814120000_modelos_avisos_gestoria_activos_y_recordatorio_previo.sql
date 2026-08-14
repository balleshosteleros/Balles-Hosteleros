-- ============================================================
-- 20260814120000_modelos_avisos_gestoria_activos_y_recordatorio_previo.sql
--
-- 1) El aviso a la gestoría pasa a estar ACTIVO por defecto.
--    Estaba en `false`, así que ninguna empresa pedía sus modelos sola: el
--    2T 2026 de Habana y Bacanal se quedó en borrador (303 y 111 en rojo)
--    porque el 21 de julio no salió ningún correo.
--
-- 2) Nuevo RECORDATORIO PREVIO, meramente informativo: avisa N días ANTES de
--    que venza el plazo (por defecto 5) de que toca presentar. No pide nada a
--    la gestoría ni genera enlace de subida — eso sigue siendo el aviso
--    posterior al vencimiento. Es opcional y configurable desde
--    Gestoría → Modelos → Configuración.
--
-- Idempotente: re-ejecutable sin efectos secundarios.
-- ============================================================

-- ─── 1. AVISO A LA GESTORÍA: ACTIVO POR DEFECTO ────────────
ALTER TABLE public.modelos_config
  ALTER COLUMN email_trim_activo  SET DEFAULT true,
  ALTER COLUMN email_anual_activo SET DEFAULT true;

-- Empresas ya existentes: se encienden también (decisión de Iván, 14-ago-2026).
UPDATE public.modelos_config
   SET email_trim_activo  = true,
       email_anual_activo = true,
       updated_at = now()
 WHERE email_trim_activo  IS DISTINCT FROM true
    OR email_anual_activo IS DISTINCT FROM true;

-- ─── 2. RECORDATORIO PREVIO AL VENCIMIENTO ─────────────────
-- Informativo: "en N días vence el plazo del 2T". Activo por defecto a 5 días.
ALTER TABLE public.modelos_config
  ADD COLUMN IF NOT EXISTS recordatorio_previo_activo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS recordatorio_previo_dias   integer NOT NULL DEFAULT 5;

-- Ventana razonable: entre 1 y 30 días antes del vencimiento.
ALTER TABLE public.modelos_config
  DROP CONSTRAINT IF EXISTS modelos_config_recordatorio_previo_dias_chk;
ALTER TABLE public.modelos_config
  ADD CONSTRAINT modelos_config_recordatorio_previo_dias_chk
  CHECK (recordatorio_previo_dias BETWEEN 1 AND 30);

COMMENT ON COLUMN public.modelos_config.recordatorio_previo_activo IS
  'Recordatorio informativo N días ANTES de vencer el plazo. No pide modelos a la gestoría (eso es email_trim/anual_activo, que se dispara TRAS el vencimiento).';
COMMENT ON COLUMN public.modelos_config.recordatorio_previo_dias IS
  'Días naturales de antelación del recordatorio previo (1-30). Por defecto 5.';
