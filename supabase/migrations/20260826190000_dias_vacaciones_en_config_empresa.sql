-- Los días de vacaciones al año pasan a la CONFIGURACIÓN de la empresa.
--
-- Antes vivían en `rrhh_calendarios_vacaciones.dias_totales`, es decir, colgando
-- de un "calendario" al que cada empleado apuntaba con
-- `empleados.calendario_vacaciones_id`. Pero calendarios como tal no existen en
-- el negocio: hay UN único calendario por empresa donde se registran las
-- ausencias y los festivos de todos. El modelo sobraba, y además dejaba a los
-- empleados sin calendario asignado con 0 días de vacaciones.
--
-- Ahora los días son un valor por empresa, editable en
-- Calendario → Configuración, y se leen desde `calendario-config-actions.ts`.
--
-- Idempotente: solo escribe el valor si la empresa aún no lo tiene.

UPDATE public.empresas
SET datos_generales =
      coalesce(datos_generales, '{}'::jsonb)
      || jsonb_build_object(
           'diasVacacionesAnio',
           coalesce(
             -- Se conservan los días que ya tuviera su calendario activo.
             (SELECT c.dias_totales
                FROM public.rrhh_calendarios_vacaciones c
               WHERE c.empresa_id = empresas.id AND c.activo
               ORDER BY c.anio DESC NULLS LAST
               LIMIT 1),
             30
           )
         )
WHERE datos_generales->>'diasVacacionesAnio' IS NULL;
