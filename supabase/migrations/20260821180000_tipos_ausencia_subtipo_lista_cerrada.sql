-- ============================================================================
-- Tipos de ausencia: LISTA CERRADA atada al subtipo del sistema.
--
-- PROBLEMA
-- Hasta ahora había DOS listas de ausencias que no se hablaban:
--   1. `tipos_ausencia` (configuración de RRHH): filas libres, el admin las
--      crea, renombra, desactiva y borra.
--   2. Lo que ve el empleado al pedir una ausencia: un array FIJO en el código
--      (baja médica, vacaciones, permiso, baja de contrato).
-- El único puente era una búsqueda por texto (`nombre ILIKE '%baja%'`) para leer
-- el límite anual de días. De ahí salían tres fallos reales:
--   · Crear "Mudanza" en configuración no la mostraba a nadie.
--   · Desactivar "Baja médica" NO la quitaba del selector del empleado y encima
--     hacía que el límite anual dejara de aplicarse (la consulta filtra por
--     activo=true; sin fila, el límite queda NULL → sin tope).
--   · Renombrar el tipo rompía el límite en silencio, y `%baja%` también casaba
--     con "Baja de contrato" o "Baja voluntaria" (cogía el límite de otra fila).
--
-- SOLUCIÓN
-- Cada fila de `tipos_ausencia` queda atada a un subtipo del sistema por CÓDIGO
-- (`subtipo`), no por nombre. La lista es CERRADA: no se pueden añadir tipos
-- nuevos, porque cada subtipo lleva asociado un comportamiento propio del
-- programa (el cupo de vacaciones, el parte médico, la baja de contrato con
-- firma y preaviso). El admin sigue mandando sobre lo suyo: nombre visible,
-- color, límite de días, si requiere aprobación/justificante, y `activo`.
--
-- A partir de aquí `activo` bloquea DE VERDAD: un subtipo inactivo desaparece
-- del selector del empleado y el servidor rechaza la solicitud.
--
-- Idempotente: re-ejecutable sin error.
-- ============================================================================

-- ── 1. Columna `subtipo` ────────────────────────────────────────────────────
ALTER TABLE public.tipos_ausencia
  ADD COLUMN IF NOT EXISTS subtipo text;

COMMENT ON COLUMN public.tipos_ausencia.subtipo IS
  'Subtipo del sistema al que está atada esta fila (lista cerrada): vacaciones, '
  'baja_medica, permiso, baja_contrato. Es el enlace con solicitudes_personal.subtipo. '
  'El nombre es solo la etiqueta visible y puede cambiarse sin romper nada.';

-- ── 2. Atar las filas existentes por nombre (última vez que se usa el texto) ──
-- Se hace ANTES de poner el NOT NULL para no perder lo ya configurado por cada
-- empresa (límites, colores, aprobación). El orden importa: "baja de contrato"
-- y "baja voluntaria" se resuelven primero para que no las capture '%baja%'.
UPDATE public.tipos_ausencia SET subtipo = 'baja_contrato'
  WHERE subtipo IS NULL
    AND (lower(nombre) LIKE '%contrato%' OR lower(nombre) LIKE '%voluntaria%');

UPDATE public.tipos_ausencia SET subtipo = 'vacaciones'
  WHERE subtipo IS NULL AND lower(nombre) LIKE '%vacacion%';

UPDATE public.tipos_ausencia SET subtipo = 'baja_medica'
  WHERE subtipo IS NULL
    AND (lower(nombre) LIKE '%baja%' OR lower(nombre) LIKE '%medic%'
         OR lower(nombre) LIKE '%médic%' OR lower(nombre) LIKE '%enferm%');

UPDATE public.tipos_ausencia SET subtipo = 'permiso'
  WHERE subtipo IS NULL
    AND (lower(nombre) LIKE '%permiso%' OR lower(nombre) LIKE '%justificada%'
         OR lower(nombre) LIKE '%asunto%');

-- Lo que no case con nada era un tipo inventado que el empleado nunca pudo
-- pedir (la lista del empleado siempre fue fija): se retira de la lista cerrada
-- pero NO se borra, para no perder el histórico ni lo que hubiera configurado.
UPDATE public.tipos_ausencia
  SET subtipo = 'permiso', activo = false
  WHERE subtipo IS NULL;

-- ── 2b. Unificar el nombre del permiso ──────────────────────────────────────
-- La misma ausencia se había renombrado a mano distinto en cada empresa
-- ("Permiso" en una, "Justificada" en otra), pero ese nombre no lo veía nadie:
-- el empleado siempre vio la lista cableada en el código. Al pasar a mostrar el
-- nombre configurado, se unifica a "Permiso" — el que todos los empleados han
-- visto siempre — para que el cambio no altere lo que ya conocen.
UPDATE public.tipos_ausencia
  SET nombre = 'Permiso'
  WHERE subtipo = 'permiso' AND nombre <> 'Permiso';

-- ── 3. Completar los 4 subtipos en TODAS las empresas ───────────────────────
-- Cada empresa debe tener las 4 filas para poder configurarlas. Las que falten
-- se crean con los valores por defecto del negocio.
INSERT INTO public.tipos_ausencia
  (empresa_id, nombre, descripcion, categoria, color, subtipo,
   requiere_aprobacion, requiere_justificante, descuenta_jornada, refleja_calendario,
   limite_dias, conteo_dias, remunerada, orden, activo)
SELECT e.id, v.nombre, v.descripcion, 'Permiso', v.color, v.subtipo,
       v.req_aprob, v.req_just, v.desc_jor, true,
       NULL::integer, 'naturales', v.rem, v.orden, true
FROM public.empresas e
CROSS JOIN (VALUES
  ('Vacaciones',      'Días de vacaciones del año en curso',      'bg-emerald-500', 'vacaciones',    true,  false, true,  true,  1),
  ('Baja médica',     'Indisposición o enfermedad con parte médico','bg-rose-500',  'baja_medica',   false, true,  false, true,  2),
  ('Permiso',         'Permiso retribuido o asunto propio',        'bg-amber-500',  'permiso',       true,  true,  true,  false, 3),
  ('Baja de contrato','Solicitud de baja voluntaria de la empresa','bg-slate-500',  'baja_contrato', true,  false, true,  false, 4)
) AS v(nombre, descripcion, color, subtipo, req_aprob, req_just, desc_jor, rem, orden)
WHERE NOT EXISTS (
  SELECT 1 FROM public.tipos_ausencia t
  WHERE t.empresa_id = e.id AND t.subtipo = v.subtipo
);

-- ── 3b. Orden estable de la lista ───────────────────────────────────────────
-- Las filas heredadas y las recién creadas podían empatar en `orden` (p. ej.
-- Vacaciones y Baja médica ambas en 1), y entonces la lista salía en un orden
-- arbitrario. Se fija el orden del negocio, igual en todas las empresas.
UPDATE public.tipos_ausencia SET orden = CASE subtipo
  WHEN 'vacaciones' THEN 1
  WHEN 'baja_medica' THEN 2
  WHEN 'permiso' THEN 3
  WHEN 'baja_contrato' THEN 4
END;

-- ── 4. Blindar la lista cerrada ─────────────────────────────────────────────
ALTER TABLE public.tipos_ausencia
  ALTER COLUMN subtipo SET NOT NULL;

ALTER TABLE public.tipos_ausencia
  DROP CONSTRAINT IF EXISTS tipos_ausencia_subtipo_check;
ALTER TABLE public.tipos_ausencia
  ADD CONSTRAINT tipos_ausencia_subtipo_check
  CHECK (subtipo IN ('vacaciones', 'baja_medica', 'permiso', 'baja_contrato'));

-- Un subtipo, una fila por empresa: impide duplicados que harían ambiguo cuál
-- manda (el fallo del `.limit(1)` sobre un ILIKE que casaba con varias filas).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_tipos_ausencia_empresa_subtipo
  ON public.tipos_ausencia (empresa_id, subtipo);
