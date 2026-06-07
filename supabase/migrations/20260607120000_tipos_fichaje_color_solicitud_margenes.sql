-- ============================================================================
-- Tipos de fichaje: color por tipo + modo "solo por solicitud" + márgenes
-- ----------------------------------------------------------------------------
-- Amplía el catálogo `tipos_fichaje` (UI: RRHH → Horarios → Tipos de fichaje)
-- con 4 columnas nuevas:
--
--   • color               clave de color de la paleta de la app ('sky', 'orange'…)
--                         para pintar el badge del fichaje según su tipo.
--   • requiere_solicitud  si TRUE el tipo solo está disponible cuando el empleado
--                         tiene una solicitud de trabajo aprobada para ese día
--                         (p. ej. horas extras). Si FALSE es "fichaje normal".
--   • margen_antes_min    minutos antes del horario previsto en los que se admite
--                         el fichaje normal (solo aplica si requiere_solicitud=FALSE).
--   • margen_despues_min  minutos después del horario previsto en los que se admite
--                         el fichaje normal (solo aplica si requiere_solicitud=FALSE).
--
-- El fichaje normal exige que el empleado tenga horario asignado ese día; sin
-- horario no se permite (lógica en server, no en BD).
-- ============================================================================

-- 1) Columnas nuevas
ALTER TABLE public.tipos_fichaje
  ADD COLUMN IF NOT EXISTS color              text    NOT NULL DEFAULT 'slate',
  ADD COLUMN IF NOT EXISTS requiere_solicitud boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS margen_antes_min   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margen_despues_min integer NOT NULL DEFAULT 0;

-- Márgenes no negativos
ALTER TABLE public.tipos_fichaje
  DROP CONSTRAINT IF EXISTS tipos_fichaje_margenes_no_negativos;
ALTER TABLE public.tipos_fichaje
  ADD CONSTRAINT tipos_fichaje_margenes_no_negativos
  CHECK (margen_antes_min >= 0 AND margen_despues_min >= 0);

-- 2) Backfill de los dos tipos canónicos en empresas EXISTENTES
--    NOR (normal) → azul, sin solicitud, márgenes 15/15 por defecto
UPDATE public.tipos_fichaje
SET color = 'sky', requiere_solicitud = false,
    margen_antes_min = 15, margen_despues_min = 15
WHERE upper(codigo) = 'NOR';

--    EXT (horas extras) → naranja, solo por solicitud
UPDATE public.tipos_fichaje
SET color = 'orange', requiere_solicitud = true
WHERE upper(codigo) = 'EXT';

-- 3) Actualizar el seed canónico para empresas NUEVAS
CREATE OR REPLACE FUNCTION public.seed_tipos_fichaje_default(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  INSERT INTO public.tipos_fichaje
    (empresa_id, nombre, codigo, descripcion, computa_tiempo, orden, activo,
     color, requiere_solicitud, margen_antes_min, margen_despues_min)
  VALUES
    (p_empresa_id, 'Fichaje normal',       'NOR', 'Jornada ordinaria',
       true, 1, true, 'sky',    false, 15, 15),
    (p_empresa_id, 'Fichaje horas extras', 'EXT', 'Horas trabajadas fuera de jornada',
       true, 2, true, 'orange', true,   0,  0)
  ON CONFLICT (empresa_id, upper(codigo)) DO NOTHING;
END;
$$;
