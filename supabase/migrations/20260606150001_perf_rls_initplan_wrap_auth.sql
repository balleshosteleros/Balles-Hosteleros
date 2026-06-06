-- PERF: envolver auth.uid()/role()/jwt()/email() en subselect en las 170
-- políticas RLS afectadas (lint auth_rls_initplan). Antes se evaluaban POR FILA;
-- ahora una sola vez (initplan) → cae drásticamente la CPU por query, que era
-- la causa principal de los logins de 2 minutos.
-- Aplicado en prod vía MCP el 2026-06-06; este archivo versiona el cambio.
CREATE OR REPLACE FUNCTION pg_temp.fix_initplan(expr text) RETURNS text AS $f$
DECLARE v text := expr;
BEGIN
  IF v IS NULL THEN RETURN NULL; END IF;
  -- proteger las que ya estan envueltas (evita doble (SELECT ...))
  v := regexp_replace(v, '\(\s*SELECT\s+auth\.uid\(\)(\s+AS\s+uid)?\s*\)',   '@@UID@@',   'g');
  v := regexp_replace(v, '\(\s*SELECT\s+auth\.role\(\)(\s+AS\s+role)?\s*\)', '@@ROLE@@',  'g');
  v := regexp_replace(v, '\(\s*SELECT\s+auth\.jwt\(\)(\s+AS\s+jwt)?\s*\)',   '@@JWT@@',   'g');
  v := regexp_replace(v, '\(\s*SELECT\s+auth\.email\(\)(\s+AS\s+email)?\s*\)','@@EMAIL@@', 'g');
  -- envolver las llamadas "desnudas"
  v := replace(v, 'auth.uid()',   '(SELECT auth.uid())');
  v := replace(v, 'auth.role()',  '(SELECT auth.role())');
  v := replace(v, 'auth.jwt()',   '(SELECT auth.jwt())');
  v := replace(v, 'auth.email()', '(SELECT auth.email())');
  -- restaurar las protegidas
  v := replace(v, '@@UID@@',   '(SELECT auth.uid() AS uid)');
  v := replace(v, '@@ROLE@@',  '(SELECT auth.role() AS role)');
  v := replace(v, '@@JWT@@',   '(SELECT auth.jwt() AS jwt)');
  v := replace(v, '@@EMAIL@@', '(SELECT auth.email() AS email)');
  RETURN v;
END $f$ LANGUAGE plpgsql;

DO $do$
DECLARE
  r record;
  nq text;
  nwc text;
  sql text;
BEGIN
  FOR r IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname='public'
      AND ( qual ~ 'auth\.(uid|role|jwt|email)\(\)'
         OR with_check ~ 'auth\.(uid|role|jwt|email)\(\)' )
  LOOP
    nq  := pg_temp.fix_initplan(r.qual);
    nwc := pg_temp.fix_initplan(r.with_check);
    sql := format('ALTER POLICY %I ON public.%I', r.policyname, r.tablename);
    IF nq  IS NOT NULL THEN sql := sql || ' USING ('||nq||')'; END IF;
    IF nwc IS NOT NULL THEN sql := sql || ' WITH CHECK ('||nwc||')'; END IF;
    EXECUTE sql;
  END LOOP;
END $do$;
