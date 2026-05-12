-- ============================================================
-- 096_harden_carpetas_documentos_funcs.sql
--
-- Cierra el acceso anon a las 2 funciones SECURITY DEFINER
-- creadas en la migración 095 (carpetas_documentos).
-- + añade SET search_path por consistencia.
-- ============================================================

-- Trigger interno: nadie debe poder llamarlo via API
REVOKE EXECUTE ON FUNCTION public.tg_seed_carpetas_documentos() FROM PUBLIC, anon, authenticated;

-- RPC: solo authenticated, nunca anon
REVOKE EXECUTE ON FUNCTION public.seed_carpetas_documentos_default(uuid) FROM PUBLIC, anon;

-- Mitigación schema-shadow
ALTER FUNCTION public.seed_carpetas_documentos_default(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.tg_seed_carpetas_documentos()         SET search_path = public, pg_temp;
