-- ============================================================
-- 20260518110000_mensajes_fichajes_rls_canonico.sql
--
-- Versiona en git las RLS reales de `mensajes` y `fichajes`.
--
-- Problema (Doc 4 §2): las migraciones 008 y 009 crearon policies
-- con `using (true)` / `with check (true)` para INSERT y UPDATE.
-- En remoto fueron reemplazadas por policies tenant-scoped, pero
-- esos reemplazos NUNCA se versionaron: un clon limpio aplicaría
-- 008/009 y se quedaría con las policies abiertas.
--
-- Comparativa git vs remoto verificada (MCP 2026-05-18):
--   mensajes:
--     git 008 → mensajes_read, mensajes_insert con USING/CHECK (true)
--     remoto → mismos NOMBRES, qual filtra por canales.empresa_id
--              vía profiles.empresa_id
--   fichajes:
--     git 009 → fichajes_read (filtrado), fichajes_insert (CHECK true),
--               fichajes_update (USING true)
--     remoto → policies con NOMBRES NUEVOS:
--                fichajes_read_empresa, fichajes_insert_own,
--                fichajes_update_own, fichajes_manage_empresa
--              todos tenant-scoped vía profiles.empresa_id
--
-- Esta migración es IDEMPOTENTE:
--   1. DROP IF EXISTS de las policies viejas con USING/CHECK (true)
--   2. DROP IF EXISTS + CREATE de las policies canónicas tenant-scoped
--
-- NOTA: las policies remotas usan `profiles.empresa_id` (legacy) en
-- lugar de `is_member_of_empresa(empresa_id)` (canónico Doc 4 §5.3).
-- Se mantiene el comportamiento exacto del remoto para no alterar
-- acceso. La unificación a `is_member_of_empresa` queda como mejora
-- posterior (Doc 4 §4: doble fuente de verdad).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. mensajes
-- ────────────────────────────────────────────────────────────
-- Las policies con nombres `mensajes_read` y `mensajes_insert` existen
-- tanto en git (abiertas) como en remoto (tenant-scoped). DROP + CREATE
-- garantiza la forma exacta.

DROP POLICY IF EXISTS mensajes_read   ON public.mensajes;
DROP POLICY IF EXISTS mensajes_insert ON public.mensajes;

CREATE POLICY mensajes_read ON public.mensajes
  FOR SELECT TO authenticated
  USING (
    canal_id IN (
      SELECT canales.id FROM public.canales
       WHERE canales.empresa_id IN (
         SELECT p.empresa_id FROM public.profiles p
          WHERE p.user_id = auth.uid()
       )
    )
  );

CREATE POLICY mensajes_insert ON public.mensajes
  FOR INSERT TO authenticated
  WITH CHECK (
    canal_id IN (
      SELECT canales.id FROM public.canales
       WHERE canales.empresa_id IN (
         SELECT p.empresa_id FROM public.profiles p
          WHERE p.user_id = auth.uid()
       )
    )
  );

COMMENT ON POLICY mensajes_read ON public.mensajes IS
  'Doc 4 §5: leer solo mensajes de canales cuya empresa coincide con profiles.empresa_id del usuario.';
COMMENT ON POLICY mensajes_insert ON public.mensajes IS
  'Doc 4 §5: insertar solo en canales de la empresa del usuario.';

-- ────────────────────────────────────────────────────────────
-- 2. fichajes
-- ────────────────────────────────────────────────────────────
-- 009 creó: fichajes_read, fichajes_insert (CHECK true), fichajes_update (USING true)
-- En remoto, las dos abiertas fueron reemplazadas por 4 policies con
-- nuevos nombres. Limpiamos las viejas y creamos las canónicas.

DROP POLICY IF EXISTS fichajes_read   ON public.fichajes;  -- 009: nombre viejo de SELECT
DROP POLICY IF EXISTS fichajes_insert ON public.fichajes;  -- 009: CHECK true
DROP POLICY IF EXISTS fichajes_update ON public.fichajes;  -- 009: USING true

DROP POLICY IF EXISTS fichajes_read_empresa   ON public.fichajes;
DROP POLICY IF EXISTS fichajes_insert_own     ON public.fichajes;
DROP POLICY IF EXISTS fichajes_update_own     ON public.fichajes;
DROP POLICY IF EXISTS fichajes_manage_empresa ON public.fichajes;

-- SELECT: ver fichajes de la empresa del usuario (autenticado)
CREATE POLICY fichajes_read_empresa ON public.fichajes
  FOR SELECT TO authenticated
  USING (
    empresa_id IN (
      SELECT p.empresa_id FROM public.profiles p
       WHERE p.user_id = auth.uid()
    )
  );

-- INSERT: cada empleado solo puede fichar como sí mismo y dentro de su empresa
CREATE POLICY fichajes_insert_own ON public.fichajes
  FOR INSERT TO authenticated
  WITH CHECK (
    empleado_id = auth.uid()
    AND empresa_id IN (
      SELECT p.empresa_id FROM public.profiles p
       WHERE p.user_id = auth.uid()
    )
  );

-- UPDATE propio: cada empleado solo puede modificar sus propios fichajes
CREATE POLICY fichajes_update_own ON public.fichajes
  FOR UPDATE TO authenticated
  USING (empleado_id = auth.uid())
  WITH CHECK (empleado_id = auth.uid());

-- ALL para responsables/admins de la empresa (gestión manual desde RRHH).
-- El control fino por rol se hace en código (server actions); RLS solo
-- garantiza scope tenant.
CREATE POLICY fichajes_manage_empresa ON public.fichajes
  FOR ALL TO authenticated
  USING (
    empresa_id IN (
      SELECT p.empresa_id FROM public.profiles p
       WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    empresa_id IN (
      SELECT p.empresa_id FROM public.profiles p
       WHERE p.user_id = auth.uid()
    )
  );

COMMENT ON POLICY fichajes_read_empresa   ON public.fichajes IS
  'Doc 4 §5: leer fichajes solo de la empresa del usuario.';
COMMENT ON POLICY fichajes_insert_own     ON public.fichajes IS
  'Doc 4 §5: empleado solo ficha como sí mismo y en su empresa.';
COMMENT ON POLICY fichajes_update_own     ON public.fichajes IS
  'Doc 4 §5: empleado solo modifica sus propios fichajes.';
COMMENT ON POLICY fichajes_manage_empresa ON public.fichajes IS
  'Doc 4 §5: gestión manual por la empresa (rol filtrado en server actions). RLS solo limita tenant.';
