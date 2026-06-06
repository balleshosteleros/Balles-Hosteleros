-- ============================================================================
-- Tipos de fichaje: dejar SOLO "Fichaje normal" y "Fichaje horas extras"
-- ----------------------------------------------------------------------------
-- El catálogo `tipos_fichaje` (UI: RRHH → Horarios → Tipos de fichaje) pasa a
-- tener únicamente dos entradas por empresa. Se eliminan los tipos legacy
-- (Entrada/ENT, Salida/SAL, Inicio pausa/IPA, Fin pausa/FPA, Fichaje manual/MAN,
-- Fichaje corregido/COR, Fichaje validado/VAL) en TODAS las empresas.
--
-- Nota: `fichajes.tipo` NO tiene FK contra esta tabla (es un catálogo de
-- configuración, no una restricción del registro de fichajes), por lo que el
-- borrado es seguro y no afecta a los fichajes existentes.
--
-- Se añade además un trigger para que las empresas NUEVAS reciban estos dos
-- tipos por defecto (antes no existía seed automático para este catálogo).
-- ============================================================================

-- 1) Función de seed canónico (idempotente)
CREATE OR REPLACE FUNCTION public.seed_tipos_fichaje_default(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  INSERT INTO public.tipos_fichaje
    (empresa_id, nombre, codigo, descripcion, computa_tiempo, orden, activo)
  VALUES
    (p_empresa_id, 'Fichaje normal',      'NOR', 'Jornada ordinaria',                 true, 1, true),
    (p_empresa_id, 'Fichaje horas extras', 'EXT', 'Horas trabajadas fuera de jornada', true, 2, true)
  ON CONFLICT (empresa_id, upper(codigo)) DO NOTHING;
END;
$$;

-- 2) Limpieza para empresas EXISTENTES: borrar todos y sembrar los dos nuevos
DELETE FROM public.tipos_fichaje
WHERE upper(codigo) NOT IN ('NOR', 'EXT');

DO $$
DECLARE
  e RECORD;
BEGIN
  FOR e IN SELECT id FROM public.empresas LOOP
    PERFORM public.seed_tipos_fichaje_default(e.id);
  END LOOP;
END;
$$;

-- 3) Trigger para empresas NUEVAS
CREATE OR REPLACE FUNCTION public.empresas_seed_tipos_fichaje_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  PERFORM public.seed_tipos_fichaje_default(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_empresas_seed_tipos_fichaje ON public.empresas;
CREATE TRIGGER trg_empresas_seed_tipos_fichaje
  AFTER INSERT ON public.empresas
  FOR EACH ROW
  EXECUTE FUNCTION public.empresas_seed_tipos_fichaje_default();
