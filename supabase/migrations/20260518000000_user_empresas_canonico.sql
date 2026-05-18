-- ============================================================
-- 20260518000000_user_empresas_canonico.sql
--
-- Versiona en git la estructura canónica de `public.user_empresas`.
-- La tabla ya existe en el remoto (creada manualmente en el pasado),
-- pero NO había migración reproducible: un clon limpio podía no
-- coincidir con producción. Doc 4 §2 de la auditoría TRIBUNAL.
--
-- Esta migración es IDEMPOTENTE: solo crea lo que falta. No reescribe
-- policies existentes salvo para garantizar que las 3 canónicas estén
-- presentes con la forma esperada.
--
-- Estado actual en remoto (verificado con MCP el 2026-05-17):
--   PK (user_id, empresa_id)
--   FK user_id    → auth.users(id) ON DELETE CASCADE
--   FK empresa_id → empresas(id)   ON DELETE CASCADE
--   Indices: PK + user_empresas_user_idx + user_empresas_empresa_idx
--   RLS habilitada con 3 policies:
--     - user_empresas_self_select  (user_id = auth.uid())
--     - user_empresas_admin_select (profiles.role = 'admin')
--     - user_empresas_admin_write  (profiles.role = 'admin', for ALL)
--   24 filas, 19 profiles con empresa, 0 huérfanos.
--
-- Además crea las funciones SQL pedidas por Doc 4 §5.3 para que el
-- resto del RLS pueda apoyarse en ellas:
--   - public.is_member_of_empresa(uuid)
--   - public.has_empresa_role(uuid, text)
-- ============================================================

-- 0. Tabla base (idempotente)
CREATE TABLE IF NOT EXISTS public.user_empresas (
  user_id    uuid NOT NULL,
  empresa_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 1. Constraints (idempotente: añade solo si no existen)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'user_empresas_pkey'
       AND conrelid = 'public.user_empresas'::regclass
  ) THEN
    ALTER TABLE public.user_empresas
      ADD CONSTRAINT user_empresas_pkey PRIMARY KEY (user_id, empresa_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'user_empresas_user_id_fkey'
       AND conrelid = 'public.user_empresas'::regclass
  ) THEN
    ALTER TABLE public.user_empresas
      ADD CONSTRAINT user_empresas_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'user_empresas_empresa_id_fkey'
       AND conrelid = 'public.user_empresas'::regclass
  ) THEN
    ALTER TABLE public.user_empresas
      ADD CONSTRAINT user_empresas_empresa_id_fkey
      FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Índices (CREATE INDEX IF NOT EXISTS es nativo)
CREATE INDEX IF NOT EXISTS user_empresas_user_idx
  ON public.user_empresas (user_id);
CREATE INDEX IF NOT EXISTS user_empresas_empresa_idx
  ON public.user_empresas (empresa_id);

-- 3. RLS (enable es idempotente)
ALTER TABLE public.user_empresas ENABLE ROW LEVEL SECURITY;

-- 4. Policies canónicas (drop + create para fijar la forma exacta).
-- Mantienen el comportamiento ya existente en remoto.
DROP POLICY IF EXISTS user_empresas_self_select  ON public.user_empresas;
DROP POLICY IF EXISTS user_empresas_admin_select ON public.user_empresas;
DROP POLICY IF EXISTS user_empresas_admin_write  ON public.user_empresas;

CREATE POLICY user_empresas_self_select ON public.user_empresas
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_empresas_admin_select ON public.user_empresas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE profiles.user_id = auth.uid()
         AND profiles.role = 'admin'
    )
  );

-- NOTA: esta policy permite a cualquier admin (rol global) escribir filas
-- para asignar acceso a CUALQUIER empresa. Es el comportamiento ya
-- existente en remoto y se mantiene por compatibilidad. El refuerzo
-- empresa-scope se hace a nivel de código en requireAdminUser (pendiente
-- en empleados-actions.ts) — no se cambia aquí para evitar romper flows
-- de plataforma que dependen de esta capacidad amplia.
CREATE POLICY user_empresas_admin_write ON public.user_empresas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE profiles.user_id = auth.uid()
         AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE profiles.user_id = auth.uid()
         AND profiles.role = 'admin'
    )
  );

-- 5. Backfill idempotente desde profiles.empresa_id (defense-in-depth).
-- En el remoto al 2026-05-17 ya hay 0 huérfanos, pero esta sentencia
-- garantiza la propiedad para clones nuevos o entornos que arrastren
-- profiles sin entry en user_empresas.
INSERT INTO public.user_empresas (user_id, empresa_id)
SELECT p.user_id, p.empresa_id
  FROM public.profiles p
 WHERE p.user_id    IS NOT NULL
   AND p.empresa_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.user_empresas ue
      WHERE ue.user_id = p.user_id
        AND ue.empresa_id = p.empresa_id
   )
ON CONFLICT (user_id, empresa_id) DO NOTHING;

-- 6. Funciones SQL canónicas (Doc 4 §5.3)
-- is_member_of_empresa(uuid): true si el usuario actual pertenece a la
-- empresa indicada. Acepta como miembro tanto user_empresas como el
-- legacy profiles.empresa_id para compatibilidad con el modelo viejo.
CREATE OR REPLACE FUNCTION public.is_member_of_empresa(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_empresas ue
     WHERE ue.user_id    = auth.uid()
       AND ue.empresa_id = p_empresa_id
  ) OR EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.user_id    = auth.uid()
       AND p.empresa_id = p_empresa_id
  );
$$;

-- La función se usa desde policies RLS y código server-side; NO debe estar
-- expuesta vía /rest/v1/rpc/ a usuarios anónimos. authenticated conserva
-- el GRANT explícito porque la función usa auth.uid().
REVOKE EXECUTE ON FUNCTION public.is_member_of_empresa(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_member_of_empresa(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.is_member_of_empresa(uuid) TO authenticated;

COMMENT ON FUNCTION public.is_member_of_empresa(uuid) IS
  'Doc 4 §5.3: true si auth.uid() es miembro de la empresa (user_empresas o profiles.empresa_id legacy).';

-- has_empresa_role(uuid, text): true si el usuario actual es miembro
-- de la empresa indicada Y tiene el rol pedido. El modelo actual de
-- roles es global (user_roles.role) — no rol por empresa — así que la
-- función cruza "membership" + "rol global". Cuando se introduzca el
-- desdoblamiento roles tenant vs roles plataforma (Doc 4 §6), esta
-- función deberá actualizarse para consultar user_empresas.rol o un
-- nuevo user_empresa_roles, sin cambiar su firma.
CREATE OR REPLACE FUNCTION public.has_empresa_role(p_empresa_id uuid, p_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  -- user_roles.role es enum app_role; comparamos con ::text para que la
  -- firma de la función siga aceptando text y no obligue al caller a
  -- castear el literal.
  SELECT public.is_member_of_empresa(p_empresa_id)
     AND EXISTS (
       SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id    = auth.uid()
          AND ur.role::text = p_role
     );
$$;

REVOKE EXECUTE ON FUNCTION public.has_empresa_role(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_empresa_role(uuid, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.has_empresa_role(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.has_empresa_role(uuid, text) IS
  'Doc 4 §5.3: true si auth.uid() es miembro de la empresa y tiene el rol global (user_roles.role::text) indicado. Cuando exista rol-por-empresa, actualizar esta función sin cambiar firma.';

-- 7. Comments documentales
COMMENT ON TABLE public.user_empresas IS
  'Fuente canónica de pertenencia user ↔ empresa. PK (user_id, empresa_id). Doc 4 §5.1.';
COMMENT ON COLUMN public.user_empresas.user_id    IS 'FK a auth.users(id).';
COMMENT ON COLUMN public.user_empresas.empresa_id IS 'FK a public.empresas(id).';
COMMENT ON COLUMN public.user_empresas.created_at IS 'Fecha de alta de la asignación.';
