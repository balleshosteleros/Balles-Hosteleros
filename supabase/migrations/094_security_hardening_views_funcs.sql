-- ============================================================
-- 091_security_hardening_views_funcs.sql
--
-- Bloque C del audit de seguridad — endurecimiento.
--
-- 1. Vistas SECURITY DEFINER → security_invoker (respetan RLS del caller).
-- 2. REVOKE EXECUTE FROM anon en 8 funciones SECURITY DEFINER.
-- 3. SET search_path en 35 funciones (mitiga schema-shadow).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. VISTAS — usar security_invoker para que respeten RLS del caller
-- ────────────────────────────────────────────────────────────
ALTER VIEW public.procesos_juridicos_resumen   SET (security_invoker = true);
ALTER VIEW public.v_cronograma_productividad   SET (security_invoker = true);

-- ────────────────────────────────────────────────────────────
-- 2. FUNCIONES SECURITY DEFINER — quitar acceso a anon
-- (Los triggers (handle_new_user, trg_seed_default_roles,
-- assign_numero_secuencial) no necesitan EXECUTE de NADIE — corren
-- con privilegios del owner de la tabla. Revocamos también de auth.)
-- ────────────────────────────────────────────────────────────

-- Triggers (revoke total)
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_numero_secuencial()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_seed_default_roles()              FROM PUBLIC, anon, authenticated;

-- RPC functions (revoke anon, mantener authenticated)
REVOKE EXECUTE ON FUNCTION public.ensure_nueva_receta_seed(uuid)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pos_next_ticket_numero(uuid)          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.seed_cronograma_ejecuciones(date,date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.seed_default_roles_for_empresa(uuid)  FROM PUBLIC, anon;

-- Helper de RLS (mantener authenticated, revocar anon)
REVOKE EXECUTE ON FUNCTION public.user_has_empresa_access(uuid)         FROM PUBLIC, anon;

-- ────────────────────────────────────────────────────────────
-- 3. SET search_path EN 35 FUNCIONES — mitigación schema-shadow
-- Patrón: search_path = public, pg_temp
-- ────────────────────────────────────────────────────────────
ALTER FUNCTION public.accesos_apps_set_updated_at()              SET search_path = public, pg_temp;
ALTER FUNCTION public.calcular_necesidad_compra(uuid)            SET search_path = public, pg_temp;
ALTER FUNCTION public.canales_pref_set_updated_at()              SET search_path = public, pg_temp;
ALTER FUNCTION public.canales_set_updated_at()                   SET search_path = public, pg_temp;
ALTER FUNCTION public.carta_likes_sync()                         SET search_path = public, pg_temp;
ALTER FUNCTION public.carta_set_updated_at()                     SET search_path = public, pg_temp;
ALTER FUNCTION public.contrataciones_set_updated_at()            SET search_path = public, pg_temp;
ALTER FUNCTION public.coste_escandallo(uuid)                     SET search_path = public, pg_temp;
ALTER FUNCTION public.cronograma_ejec_set_updated_at()           SET search_path = public, pg_temp;
ALTER FUNCTION public.departamentos_set_updated_at()             SET search_path = public, pg_temp;
ALTER FUNCTION public.empleado_esta_activo(text, date)           SET search_path = public, pg_temp;
ALTER FUNCTION public.empresa_reglas_submodulo_set_updated_at()  SET search_path = public, pg_temp;
ALTER FUNCTION public.empresas_set_updated_at()                  SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user()                          SET search_path = public, pg_temp;
ALTER FUNCTION public.lock_numero_secuencial()                   SET search_path = public, pg_temp;
ALTER FUNCTION public.paginas_web_snapshot_on_publish()          SET search_path = public, pg_temp;
ALTER FUNCTION public.paginas_web_touch()                        SET search_path = public, pg_temp;
ALTER FUNCTION public.pos_linea_sync_timestamps()                SET search_path = public, pg_temp;
ALTER FUNCTION public.pos_next_ticket_numero(uuid)               SET search_path = public, pg_temp;
ALTER FUNCTION public.prevent_update_presentado()                SET search_path = public, pg_temp;
ALTER FUNCTION public.set_docjur_updated_at()                    SET search_path = public, pg_temp;
ALTER FUNCTION public.set_empleados_updated_at()                 SET search_path = public, pg_temp;
ALTER FUNCTION public.set_empresa_roles_updated_at()             SET search_path = public, pg_temp;
ALTER FUNCTION public.set_fichajes_updated_at()                  SET search_path = public, pg_temp;
ALTER FUNCTION public.set_partes_updated_at()                    SET search_path = public, pg_temp;
ALTER FUNCTION public.set_plazos_updated_at()                    SET search_path = public, pg_temp;
ALTER FUNCTION public.set_procjur_updated_at()                   SET search_path = public, pg_temp;
ALTER FUNCTION public.set_solicitudes_personal_updated_at()      SET search_path = public, pg_temp;
ALTER FUNCTION public.set_updated_at()                           SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_profile_es_empleado()                 SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_profile_estado_from_empleado()        SET search_path = public, pg_temp;
ALTER FUNCTION public.tarifas_set_updated_at()                   SET search_path = public, pg_temp;
ALTER FUNCTION public.tg_set_updated_at()                        SET search_path = public, pg_temp;
ALTER FUNCTION public.tg_user_view_preferences_touch()           SET search_path = public, pg_temp;
ALTER FUNCTION public.update_cronogramas_updated_at()            SET search_path = public, pg_temp;
