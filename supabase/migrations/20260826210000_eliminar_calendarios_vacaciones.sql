-- Elimina el modelo de "calendarios de vacaciones".
--
-- Por qué: no existía como concepto en el negocio. Había UN solo calendario por
-- empresa ("Calendario general", 30 días, sin bloqueos) y cada empleado
-- apuntaba a él con `empleados.calendario_vacaciones_id`. Ese apuntador solo
-- servía para dar problemas: el alta no lo rellenaba, así que quien se quedaba
-- sin él veía 0 días de vacaciones, y no había ninguna pantalla para asignarlo.
--
-- Los días al año son ahora un valor por empresa, en la configuración del
-- submódulo Calendario (`empresas.datos_generales.diasVacacionesAnio`), que ya
-- se rellenó en la migración anterior.
--
-- El calendario REAL —donde se registran ausencias y festivos— no se toca: vive
-- en `solicitudes_personal` y en los festivos por empresa.

ALTER TABLE public.empleados DROP COLUMN IF EXISTS calendario_vacaciones_id;

DROP TABLE IF EXISTS public.rrhh_calendario_vacaciones_bloqueos;
DROP TABLE IF EXISTS public.rrhh_calendarios_vacaciones;
