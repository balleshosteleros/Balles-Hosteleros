-- Un usuario SIEMPRE debe tener estado de acceso. Sin estado no se entra:
-- la ausencia de dato nunca puede valer como permiso concedido.
--
-- Contexto (decisión de Ivan, 2026-08-06): el guard de login comprobaba
-- `if (estado && estado !== 'Activo')`, así que un usuario SIN estado se
-- saltaba la condición entera y colaba sin que nadie le hubiera dado el alta.
-- El código ya está corregido (solo pasa quien es exactamente 'Activo');
-- esta migración blinda el mismo criterio en la BD para que el dato no pueda
-- quedar en blanco por ninguna vía (importación, script, edición manual).
--
-- Idempotente: se puede ejecutar las veces que haga falta.

-- 1. Red de seguridad: si algún usuario se quedó sin estado, pasa a 'Inactivo'
--    (NUNCA a 'Activo' — ante la duda NO se concede acceso; que un humano lo
--    revise y lo active a mano).
UPDATE public.usuarios
SET estado_acceso = 'Inactivo'
WHERE estado_acceso IS NULL OR btrim(estado_acceso) = '';

-- 2. Obligatorio y con valor por defecto explícito.
ALTER TABLE public.usuarios
  ALTER COLUMN estado_acceso SET DEFAULT 'Activo';

ALTER TABLE public.usuarios
  ALTER COLUMN estado_acceso SET NOT NULL;

-- 3. Solo se admiten los tres estados válidos. Esto ya cierra la puerta a la
--    cadena vacía, que pasaría el NOT NULL pero no es un estado real.
ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS profiles_estado_acceso_check;

ALTER TABLE public.usuarios
  ADD CONSTRAINT profiles_estado_acceso_check
  CHECK (estado_acceso IN ('Activo', 'Inactivo', 'Pendiente'));

COMMENT ON COLUMN public.usuarios.estado_acceso IS
  'Estado de acceso al sistema. OBLIGATORIO: Activo | Inactivo | Pendiente. '
  'Solo ''Activo'' permite entrar (por contraseña y por Google). Sin estado NO se entra.';
