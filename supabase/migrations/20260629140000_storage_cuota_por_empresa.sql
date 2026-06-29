-- ============================================================================
-- Cuota de almacenamiento POR EMPRESA (sustituye la cuota global de fase beta)
-- ----------------------------------------------------------------------------
-- Antes: una única vista `storage_usage_global` sumaba el tamaño de TODAS las
-- grabaciones de todas las empresas contra un límite fijo de 9,5 GB.
-- Ahora: cada empresa tiene su propio límite (`empresas.storage_limit_bytes`,
-- por defecto 500 GB) y el uso se mide por `empresa_id`.
--
-- Los vídeos siguen viviendo en Cloudflare R2; Supabase solo lleva la cuenta.
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- ============================================================================

-- 1) Columna de límite por empresa (default 500 GB)
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS storage_limit_bytes bigint
  NOT NULL DEFAULT (500::bigint * 1024 * 1024 * 1024);

COMMENT ON COLUMN public.empresas.storage_limit_bytes IS
  'Límite de almacenamiento de grabaciones para esta empresa, en bytes. Default 500 GB. Ajustable por empresa según plan.';

-- 2) Vista de uso por empresa: bytes usados vs límite, agrupado por empresa_id.
--    Parte de `empresas` (LEFT JOIN) para que aparezcan también las empresas
--    sin ninguna grabación todavía (uso = 0).
CREATE OR REPLACE VIEW public.storage_usage_por_empresa
WITH (security_invoker = true) AS
SELECT
  e.id                                            AS empresa_id,
  e.nombre                                        AS empresa_nombre,
  COALESCE(SUM(r.file_size), 0)::bigint           AS bytes_used,
  e.storage_limit_bytes                           AS bytes_limit,
  COUNT(r.id)::integer                            AS files_count
FROM public.empresas e
LEFT JOIN public.recordings r ON r.empresa_id = e.id
GROUP BY e.id, e.nombre, e.storage_limit_bytes;

COMMENT ON VIEW public.storage_usage_por_empresa IS
  'Uso de almacenamiento de grabaciones por empresa (bytes_used) frente a su límite (bytes_limit). Los archivos viven en R2; esta vista solo agrega los tamaños registrados en `recordings`.';
