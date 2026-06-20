-- Limpieza: `empleados.jefe_directo_id` es legacy — no se usa en ningún
-- formulario, vista ni función (verificado sin dependencias). Se elimina.
-- (Aplicada en vivo vía MCP el 2026-06-20; este fichero versiona el cambio.)

ALTER TABLE public.empleados
  DROP COLUMN IF EXISTS jefe_directo_id;
