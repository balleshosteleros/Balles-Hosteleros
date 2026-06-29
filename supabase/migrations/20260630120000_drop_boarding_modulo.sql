-- Eliminación del módulo BOARDING de RRHH (alta/baja de empleados por plantillas).
-- El módulo se retira por completo del software: no quedaban procesos creados
-- (procesos_boarding vacío) y solo existían plantillas semilla.
-- El offboarding de candidatos que dependía de estas tablas también se elimina.
-- Idempotente: usa IF EXISTS y CASCADE (políticas/índices/triggers caen con la tabla).

DROP TABLE IF EXISTS public.procesos_boarding CASCADE;
DROP TABLE IF EXISTS public.plantillas_boarding CASCADE;
