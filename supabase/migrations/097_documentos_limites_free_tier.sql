-- ============================================================
-- 097_documentos_limites_free_tier.sql
--
-- Endurecer los límites del módulo Documentación para garantizar
-- que NUNCA crucemos el plan FREE de Supabase (1 GB Storage).
-- Diseñado para 100 EMPRESAS con CUOTA IDÉNTICA (igualdad total).
--
-- Reparto:
--   · Bucket `documentacion` cap: 800 MB
--   · Por empresa: 8 MB (= 800 / 100)
--   · Por archivo: 2 MB
--   · 50 docs/empresa, 50 docs/carpeta (caps nominales)
--
-- Peor caso global: 800 MB < 1 GB free tier ⇒ jamás se factura.
-- ============================================================

-- ── 1. Tamaño por archivo: 2 MB ─────────────────────────────
ALTER TABLE public.documentos
  DROP CONSTRAINT IF EXISTS documentos_tamano_max;

ALTER TABLE public.documentos
  ADD CONSTRAINT documentos_tamano_max
  CHECK (tamano_bytes IS NULL OR tamano_bytes <= 2097152); -- 2 MB

-- ── 2. Trigger de cuotas (cuenta + bytes empresa + bytes bucket) ─
CREATE OR REPLACE FUNCTION public.tg_documentos_check_quotas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  count_carpeta  int;
  count_empresa  int;
  bytes_empresa  bigint;
  bytes_bucket   bigint;
  -- Topes (free tier safe, 100 empresas iguales)
  max_carpeta        CONSTANT int    := 50;
  max_empresa        CONSTANT int    := 50;
  max_bytes_empresa  CONSTANT bigint := 8388608;     -- 8 MB
  max_bytes_bucket   CONSTANT bigint := 838860800;   -- 800 MB
BEGIN
  -- Cap nº docs por carpeta
  SELECT count(*) INTO count_carpeta
  FROM public.documentos
  WHERE carpeta_id = NEW.carpeta_id;

  IF count_carpeta >= max_carpeta THEN
    RAISE EXCEPTION 'Límite de % documentos por carpeta alcanzado', max_carpeta
      USING ERRCODE = 'check_violation';
  END IF;

  -- Cap nº docs por empresa
  SELECT count(*) INTO count_empresa
  FROM public.documentos
  WHERE empresa_id = NEW.empresa_id;

  IF count_empresa >= max_empresa THEN
    RAISE EXCEPTION 'Límite de % documentos por empresa alcanzado', max_empresa
      USING ERRCODE = 'check_violation';
  END IF;

  -- Cap bytes por empresa (hard cap igual para todas las empresas)
  SELECT COALESCE(SUM(tamano_bytes), 0) INTO bytes_empresa
  FROM public.documentos
  WHERE empresa_id = NEW.empresa_id;

  IF bytes_empresa + COALESCE(NEW.tamano_bytes, 0) > max_bytes_empresa THEN
    RAISE EXCEPTION
      'Cuota de almacenamiento alcanzada: máximo 8 MB por empresa (uso actual: % MB)',
      round(bytes_empresa::numeric / 1048576, 2)
      USING ERRCODE = 'check_violation';
  END IF;

  -- Cap bytes globales del bucket (free tier guard)
  SELECT COALESCE(SUM(tamano_bytes), 0) INTO bytes_bucket
  FROM public.documentos;

  IF bytes_bucket + COALESCE(NEW.tamano_bytes, 0) > max_bytes_bucket THEN
    RAISE EXCEPTION
      'Cuota global del módulo alcanzada: 800 MB (uso actual: % MB)',
      round(bytes_bucket::numeric / 1048576, 2)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$func$;

-- ── 3. file_size_limit del bucket: 2 MB ─────────────────────
UPDATE storage.buckets
SET file_size_limit = 2097152
WHERE id = 'documentacion';

-- ── 4. Vista helper de uso por empresa ─────────────────────
CREATE OR REPLACE VIEW public.v_documentos_uso AS
SELECT
  empresa_id,
  count(*)                            AS docs_total,
  COALESCE(SUM(tamano_bytes), 0)      AS bytes_total,
  COUNT(DISTINCT carpeta_id)          AS carpetas_usadas
FROM public.documentos
GROUP BY empresa_id;

ALTER VIEW public.v_documentos_uso SET (security_invoker = true);
