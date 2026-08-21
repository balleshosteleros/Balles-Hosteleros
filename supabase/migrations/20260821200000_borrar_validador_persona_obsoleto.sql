-- Borra las columnas de validador-PERSONA, ya sin uso.
--
-- El validador de solicitudes pasó a ser un DEPARTAMENTO
-- (`validador_departamento_id` en empleados y puestos, migración
-- 20260821160000). Desde entonces estas cuatro columnas quedaron marcadas como
-- obsoletas y ningún punto del código las lee ni las escribe.
--
-- Antes de borrar se comprobó que los 28 empleados y los 39 puestos que las
-- tenían rellenas ya tienen su departamento validador asignado, así que no se
-- pierde ninguna información: quien validaba sigue pudiendo validar, ahora por
-- pertenecer a un departamento en vez de estar nombrado uno a uno.
--
-- Al borrar las columnas se van con ellas sus índices y sus claves foráneas.
--
-- Idempotente.

ALTER TABLE public.empleados
  DROP COLUMN IF EXISTS validador_trabajo_id,
  DROP COLUMN IF EXISTS validador_ausencias_id;

ALTER TABLE public.puestos
  DROP COLUMN IF EXISTS validador_trabajo_defecto_id,
  DROP COLUMN IF EXISTS validador_ausencias_defecto_id;
