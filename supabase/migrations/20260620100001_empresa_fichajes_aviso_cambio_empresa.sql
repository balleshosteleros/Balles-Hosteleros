-- PRP-060 multi-empresa: ajuste por empresa que avisa al empleado de que su
-- jornada CONTINÚA en otra empresa al cruzar el límite entre turnos de empresas
-- distintas (en vez del reaviso de "ficha entrada"). Aplica a todos los empleados
-- de la empresa. Default = off (comportamiento actual).
-- (Aplicada en vivo vía MCP el 2026-06-20; este fichero versiona el cambio.)

ALTER TABLE public.empresa_fichajes_config
  ADD COLUMN IF NOT EXISTS aviso_cambio_empresa boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.empresa_fichajes_config.aviso_cambio_empresa IS
  'PRP-060 multi-empresa: si true, avisa al empleado multiempresa de que su jornada continúa en otra empresa al cruzar el límite entre turnos de empresas distintas.';
