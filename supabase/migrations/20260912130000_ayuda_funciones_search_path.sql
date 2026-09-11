-- search_path fijo en las funciones nuevas de la ayuda.
--
-- Sin esto, quien llame a la función puede colar un esquema propio en su
-- `search_path` y hacer que `soporte_conocimiento` o `soporte_huecos` apunten a
-- tablas suyas. Lo señalan los avisos de seguridad de Supabase.
--
-- Idempotente.
ALTER FUNCTION public.distancia_conocimiento_global(VECTOR) SET search_path = public;
ALTER FUNCTION public.buscar_hueco_parecido(VECTOR, UUID, FLOAT) SET search_path = public;
ALTER FUNCTION public.set_soporte_updated_at() SET search_path = public;
