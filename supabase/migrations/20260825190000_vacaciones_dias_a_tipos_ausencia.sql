-- Los días de vacaciones al año pasan a configurarse como el resto de
-- ausencias: en `tipos_ausencia.limite_dias` del subtipo 'vacaciones'.
--
-- Antes vivían en un calendario por empleado (`rrhh_calendarios_vacaciones`),
-- que era una segunda forma de configurar lo mismo y obligaba a asignárselo
-- uno a uno; quien no lo tuviera no podía pedir vacaciones. Ahora hay UN solo
-- calendario (el de la pantalla, que se filtra por tipo de ausencia) y los
-- ajustes de cada ausencia viven todos en el mismo sitio.
--
-- Se traslada el valor que ya tenía cada empresa en su calendario
-- predeterminado, para no cambiarle los días a nadie. Solo rellena lo vacío.
--
-- Idempotente.

UPDATE public.tipos_ausencia t
SET limite_dias = (
  SELECT c.dias_totales
  FROM public.rrhh_calendarios_vacaciones c
  WHERE c.empresa_id = t.empresa_id
    AND c.activo IS TRUE
    AND c.anio IS NULL
  ORDER BY c.created_at ASC
  LIMIT 1
)
WHERE t.subtipo = 'vacaciones'
  AND t.limite_dias IS NULL
  AND EXISTS (
    SELECT 1 FROM public.rrhh_calendarios_vacaciones c
    WHERE c.empresa_id = t.empresa_id AND c.activo IS TRUE AND c.anio IS NULL
  );

-- La columna del puesto ya no se usa: el calendario no se elige por puesto.
-- No se borra la columna de `empleados` ni las tablas de calendarios: quedan
-- como red de seguridad por si hubiera que revertir.
ALTER TABLE public.puestos
  DROP COLUMN IF EXISTS calendario_vacaciones_id;

COMMENT ON COLUMN public.empleados.calendario_vacaciones_id IS
  'OBSOLETO desde 2026-08-25: los días de vacaciones salen de tipos_ausencia.limite_dias (subtipo vacaciones). Sin uso.';
