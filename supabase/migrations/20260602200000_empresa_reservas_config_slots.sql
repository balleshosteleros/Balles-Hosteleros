-- Indicador genérico de "slots" (huecos de 15 min) activos para reservas.
-- Aplica IGUAL a todos los días: el patrón generado entre la hora de apertura
-- y la de cierre del turno (comida/cena) se rellena automáticamente con todos
-- los slots a intervalos de 15 minutos. Por defecto TODOS están activos; lo
-- que se persiste es la lista de slots DESACTIVADOS (más eficiente y a prueba
-- de cambios en el horario: si abres antes/cierras después, los nuevos slots
-- aparecen activos sin tocar nada).
--
-- Formato del elemento: "HH:MM" (zero-padded, 24h). El cliente debe enviar
-- exactamente los slots que aparezcan tachados en la UI.

ALTER TABLE public.empresa_reservas_config
  ADD COLUMN IF NOT EXISTS general_slots_inactivos_comida text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS general_slots_inactivos_cena   text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.empresa_reservas_config.general_slots_inactivos_comida IS
  'Slots de 15 min ("HH:MM") DESACTIVADOS para reservas en el turno de comida. Aplica igual a todos los días. Empty = todos activos.';
COMMENT ON COLUMN public.empresa_reservas_config.general_slots_inactivos_cena IS
  'Slots de 15 min ("HH:MM") DESACTIVADOS para reservas en el turno de cena. Aplica igual a todos los días. Empty = todos activos.';
