-- Pases de reserva (slots de 15 min) por día de la semana y por excepción.
--
-- POR QUÉ: hasta ahora la rejilla de pases era UNA SOLA para los siete días
-- (`general_slots_inactivos_*`). Eso hacía imposible lo que pedía Iván el
-- 15-09-2026: en Habana, viernes y sábado aceptan mesa hasta las 02:00 y el
-- resto de días hasta las 00:30. Se resolvió a base de darle a cada día una
-- hora de cierre distinta, pero el tope real lo marcaban unos pases apagados
-- que no se podían separar por día. Con esto, la rejilla obedece a los mismos
-- días (o fechas) que ya manda el horario.
--
-- CÓMO: solo se guarda la DIFERENCIA. Quien no se separe sigue compartiendo la
-- rejilla general, así que una empresa con todos los días iguales guarda lo
-- mismo que antes.

ALTER TABLE public.empresa_reservas_config
  ADD COLUMN IF NOT EXISTS slots_inactivos_por_dia jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.empresa_reservas_config.slots_inactivos_por_dia IS
  'Pases apagados de los días que se separan de la rejilla general. Clave "<dia>_<turno>" (p. ej. "vie_cena") → lista de horas HH:MM. Si la clave NO está, ese día hereda general_slots_inactivos_<turno>; si está con lista vacía, ese día tiene TODOS los pases activos.';

ALTER TABLE public.empresa_reservas_horarios_excepciones
  ADD COLUMN IF NOT EXISTS slots_inactivos text[];

COMMENT ON COLUMN public.empresa_reservas_horarios_excepciones.slots_inactivos IS
  'Pases apagados durante la excepción. NULL = hereda del patrón semanal (día → general); lista (aunque esté vacía) = manda sobre él.';
