-- El acceso solo tiene DOS estados: Activo o Inactivo (decisión de Ivan, 2026-08-06).
-- O entras o no entras. "Pendiente" era un tercer caso ambiguo que no escribía
-- nadie, no lo tenía ningún usuario, y obligaba a interpretarlo en cada pantalla.
--
-- Verificado antes de aplicar: 22 usuarios 'Activo' + 3 'Inactivo', ninguno
-- 'Pendiente'. Esta migración no cambia el estado de ninguna persona.
--
-- Idempotente: se puede ejecutar las veces que haga falta.

-- 1. Red de seguridad por si quedara algún 'Pendiente' (o un estado en blanco):
--    pasa a 'Inactivo', NUNCA a 'Activo'. Sin estado no hay acceso, y la
--    ausencia de dato jamás puede valer como permiso concedido.
UPDATE public.usuarios
SET estado_acceso = 'Inactivo'
WHERE estado_acceso IS NULL
   OR btrim(estado_acceso) = ''
   OR estado_acceso NOT IN ('Activo', 'Inactivo');

-- 2. Obligatorio, con valor por defecto explícito.
ALTER TABLE public.usuarios
  ALTER COLUMN estado_acceso SET DEFAULT 'Activo';

ALTER TABLE public.usuarios
  ALTER COLUMN estado_acceso SET NOT NULL;

-- 3. Solo los dos estados válidos. Cierra también la cadena vacía, que pasaría
--    el NOT NULL pero no es un estado real.
ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS profiles_estado_acceso_check;

ALTER TABLE public.usuarios
  ADD CONSTRAINT profiles_estado_acceso_check
  CHECK (estado_acceso IN ('Activo', 'Inactivo'));

COMMENT ON COLUMN public.usuarios.estado_acceso IS
  'Estado de acceso. OBLIGATORIO, solo dos valores: Activo | Inactivo. '
  'Solo ''Activo'' permite entrar (por contraseña y por Google).';
