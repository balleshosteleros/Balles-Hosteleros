-- Ajustes del motor de reservas (panel "Preferencias del motor" en /sala/configuracion).
-- Agrupa: cerrar motor web por hora del día actual, tope de personas en misma
-- hora, parpadeo visual de reservas, intervalos de reserva web, y visibilidad
-- de reservas canceladas.
--
-- Además: `reservas.duracion_minutos` permite sobreescribir la duración
-- general de la empresa para esa reserva concreta (NULL = usa la default).

-- 1) empresa_reservas_config: nuevas columnas (todas con default seguro)

ALTER TABLE public.empresa_reservas_config
  ADD COLUMN IF NOT EXISTS cerrar_motor_web_activo  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cerrar_motor_web_comida  text,
  ADD COLUMN IF NOT EXISTS cerrar_motor_web_cena    text,

  ADD COLUMN IF NOT EXISTS max_personas_hora_activo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_personas_hora_modo   text NOT NULL DEFAULT 'mismo',
  ADD COLUMN IF NOT EXISTS max_personas_hora_global integer,
  ADD COLUMN IF NOT EXISTS max_personas_hora_reglas jsonb NOT NULL DEFAULT '[]'::jsonb,

  ADD COLUMN IF NOT EXISTS parpadeo_pasado_duracion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parpadeo_0_15            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parpadeo_15_30           boolean NOT NULL DEFAULT false,

  ADD COLUMN IF NOT EXISTS intervalo_reserva_min    integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS ocultar_canceladas       boolean NOT NULL DEFAULT false;

-- Modo permitido para "número máximo en misma hora".
ALTER TABLE public.empresa_reservas_config
  DROP CONSTRAINT IF EXISTS empresa_reservas_config_max_personas_hora_modo_chk;
ALTER TABLE public.empresa_reservas_config
  ADD CONSTRAINT empresa_reservas_config_max_personas_hora_modo_chk
  CHECK (max_personas_hora_modo IN ('mismo','diferente_hora','diferente_tramo'));

-- Intervalo de reserva: 5, 10, 15, 30, 45, 60 minutos.
ALTER TABLE public.empresa_reservas_config
  DROP CONSTRAINT IF EXISTS empresa_reservas_config_intervalo_reserva_min_chk;
ALTER TABLE public.empresa_reservas_config
  ADD CONSTRAINT empresa_reservas_config_intervalo_reserva_min_chk
  CHECK (intervalo_reserva_min IN (5,10,15,30,45,60));

-- Formato HH:MM para horas de cierre del motor web (acepta NULL).
ALTER TABLE public.empresa_reservas_config
  DROP CONSTRAINT IF EXISTS empresa_reservas_config_cerrar_motor_web_comida_chk;
ALTER TABLE public.empresa_reservas_config
  ADD CONSTRAINT empresa_reservas_config_cerrar_motor_web_comida_chk
  CHECK (cerrar_motor_web_comida IS NULL OR cerrar_motor_web_comida ~ '^[0-2][0-9]:[0-5][0-9]$');

ALTER TABLE public.empresa_reservas_config
  DROP CONSTRAINT IF EXISTS empresa_reservas_config_cerrar_motor_web_cena_chk;
ALTER TABLE public.empresa_reservas_config
  ADD CONSTRAINT empresa_reservas_config_cerrar_motor_web_cena_chk
  CHECK (cerrar_motor_web_cena IS NULL OR cerrar_motor_web_cena ~ '^[0-2][0-9]:[0-5][0-9]$');

COMMENT ON COLUMN public.empresa_reservas_config.cerrar_motor_web_activo IS
  'Si true, el motor web deja de aceptar reservas a partir de las horas señaladas (comida/cena).';
COMMENT ON COLUMN public.empresa_reservas_config.max_personas_hora_reglas IS
  'Reglas por hora/tramo: [{inicio:"HH:MM", fin:"HH:MM", max:int}, …]. Vacío si modo=mismo.';
COMMENT ON COLUMN public.empresa_reservas_config.parpadeo_pasado_duracion IS
  'Cuando la reserva supera su duración, parpadea en la timeline.';
COMMENT ON COLUMN public.empresa_reservas_config.intervalo_reserva_min IS
  'Granularidad de horas ofrecidas en el motor web (5/10/15/30/45/60 min).';
COMMENT ON COLUMN public.empresa_reservas_config.ocultar_canceladas IS
  'Si true, la vista de reservas oculta por defecto las canceladas.';

-- 2) reservas: duración por reserva (override del default empresa).

ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS duracion_minutos integer;

ALTER TABLE public.reservas
  DROP CONSTRAINT IF EXISTS reservas_duracion_minutos_chk;
ALTER TABLE public.reservas
  ADD CONSTRAINT reservas_duracion_minutos_chk
  CHECK (duracion_minutos IS NULL OR duracion_minutos BETWEEN 15 AND 360);

COMMENT ON COLUMN public.reservas.duracion_minutos IS
  'Duración de esta reserva en minutos. NULL = usa la default de empresa (empresa_reservas_config.duracion_reserva_min). Solo editable a nivel de reserva.';
