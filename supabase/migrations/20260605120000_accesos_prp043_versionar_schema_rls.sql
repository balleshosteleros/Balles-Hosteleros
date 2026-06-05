-- =============================================================================
-- Accesos (PRP-043) — versionado del schema + RLS que ya estaba LIVE en prod
-- =============================================================================
-- Contexto: las 3 tablas del modelo nuevo de accesos (apps_externas,
-- app_credenciales, app_credencial_roles), sus funciones de seguridad, RLS,
-- indices y triggers se aplicaron A MANO sobre produccion y NUNCA se
-- versionaron (0 migraciones .sql). Esta migracion captura EXACTAMENTE el
-- estado vivo verificado por Management API el 2026-06-05.
--
-- Es 100% IDEMPOTENTE: en prod es un no-op (todo ya existe con estas
-- definiciones); en un entorno limpio (CI, dev nuevo, empresa nueva,
-- recreacion de BD) crea todo el modelo y deja /accesos operativo y seguro.
--
-- Cierra la "deuda de seguridad urgente" senalada en OLA2-15: el schema deja
-- de ser irreproducible y la RLS de revelado de credenciales pasa a tener una
-- fuente de verdad auditable.
--
-- NOTA: has_empresa_access() NO se redefine aqui (ya esta versionada en
-- 20260518100000_empresas_rls_canonico.sql y la usan ~130 politicas).
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tablas (orden por dependencias de FK)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.apps_externas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  url         text,
  logo_url    text,
  categoria   text NOT NULL DEFAULT 'Otros',
  notas       text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT apps_externas_empresa_nombre_unique UNIQUE (empresa_id, nombre)
);

CREATE TABLE IF NOT EXISTS public.app_credenciales (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id           uuid NOT NULL REFERENCES public.apps_externas(id) ON DELETE CASCADE,
  empresa_id       uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  etiqueta         text NOT NULL,
  usuario          text NOT NULL,
  password_cifrado text NOT NULL,
  url_especifica   text,
  notas            text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.app_credencial_roles (
  credencial_id uuid NOT NULL REFERENCES public.app_credenciales(id) ON DELETE CASCADE,
  rol_id        uuid NOT NULL REFERENCES public.empresa_roles(id) ON DELETE CASCADE,
  empresa_id    uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (credencial_id, rol_id)
);

-- ----------------------------------------------------------------------------
-- 2. Indices
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_apps_externas_empresa        ON public.apps_externas      USING btree (empresa_id);
CREATE INDEX IF NOT EXISTS idx_app_credenciales_empresa     ON public.app_credenciales   USING btree (empresa_id);
CREATE INDEX IF NOT EXISTS idx_app_credenciales_app         ON public.app_credenciales   USING btree (app_id);
CREATE INDEX IF NOT EXISTS idx_app_credencial_roles_empresa ON public.app_credencial_roles USING btree (empresa_id);
CREATE INDEX IF NOT EXISTS idx_app_credencial_roles_rol     ON public.app_credencial_roles USING btree (rol_id);

-- ----------------------------------------------------------------------------
-- 3. Trigger updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_apps_externas_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END
$function$;

DROP TRIGGER IF EXISTS apps_externas_set_updated_at ON public.apps_externas;
CREATE TRIGGER apps_externas_set_updated_at
  BEFORE UPDATE ON public.apps_externas
  FOR EACH ROW EXECUTE FUNCTION public.tg_apps_externas_set_updated_at();

DROP TRIGGER IF EXISTS app_credenciales_set_updated_at ON public.app_credenciales;
CREATE TRIGGER app_credenciales_set_updated_at
  BEFORE UPDATE ON public.app_credenciales
  FOR EACH ROW EXECUTE FUNCTION public.tg_apps_externas_set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Funciones de seguridad (SECURITY DEFINER, search_path fijo)
--    has_empresa_access() ya esta versionada en otra migracion: NO se toca.
-- ----------------------------------------------------------------------------

-- Es director global de la app (user_roles.role = 'director')
CREATE OR REPLACE FUNCTION public.is_app_director()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role::text = 'director'
  )
$function$;

-- Puede crear/editar/borrar credenciales (director o DIRECCION/GERENCIA/DIRECTOR)
CREATE OR REPLACE FUNCTION public.can_manage_credenciales()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    public.is_app_director()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.rol_label IS NOT NULL
        AND p.rol_label IN ('DIRECCIÓN','GERENCIA','DIRECTOR')
    )
$function$;

-- El rol del usuario (profiles.rol_label) coincide con alguno de los roles
-- asignados a la credencial. Esta es la barrera real de "revelado": sin ella,
-- el cifrado en reposo no protegeria nada.
CREATE OR REPLACE FUNCTION public.user_has_credencial_role(cred_id uuid, cred_empresa_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_credencial_roles acr
    JOIN public.empresa_roles er ON er.id = acr.rol_id
    JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE acr.credencial_id = cred_id
      AND er.empresa_id = cred_empresa_id
      AND p.rol_label IS NOT NULL
      AND er.nombre = p.rol_label
  )
$function$;

-- ----------------------------------------------------------------------------
-- 5. RLS — habilitar + politicas (DROP IF EXISTS + CREATE = idempotente)
-- ----------------------------------------------------------------------------
ALTER TABLE public.apps_externas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_credenciales     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_credencial_roles ENABLE ROW LEVEL SECURITY;

-- apps_externas: lectura para cualquier miembro del tenant; escritura solo gestores
DROP POLICY IF EXISTS apps_externas_tenant_read  ON public.apps_externas;
CREATE POLICY apps_externas_tenant_read ON public.apps_externas
  FOR SELECT USING (has_empresa_access(empresa_id));

DROP POLICY IF EXISTS apps_externas_manage_write ON public.apps_externas;
CREATE POLICY apps_externas_manage_write ON public.apps_externas
  FOR ALL
  USING (has_empresa_access(empresa_id) AND can_manage_credenciales())
  WITH CHECK (has_empresa_access(empresa_id) AND can_manage_credenciales());

-- app_credenciales: LECTURA restringida por interseccion de roles (la clave de
-- seguridad del modulo); escritura solo gestores
DROP POLICY IF EXISTS app_credenciales_tenant_role_read ON public.app_credenciales;
CREATE POLICY app_credenciales_tenant_role_read ON public.app_credenciales
  FOR SELECT
  USING (
    has_empresa_access(empresa_id)
    AND (is_app_director() OR user_has_credencial_role(id, empresa_id))
  );

DROP POLICY IF EXISTS app_credenciales_manage_write ON public.app_credenciales;
CREATE POLICY app_credenciales_manage_write ON public.app_credenciales
  FOR ALL
  USING (has_empresa_access(empresa_id) AND can_manage_credenciales())
  WITH CHECK (has_empresa_access(empresa_id) AND can_manage_credenciales());

-- app_credencial_roles: lectura para gestores o para quien ya tiene el rol de
-- la credencial; escritura solo gestores
DROP POLICY IF EXISTS app_credencial_roles_tenant_read ON public.app_credencial_roles;
CREATE POLICY app_credencial_roles_tenant_read ON public.app_credencial_roles
  FOR SELECT
  USING (
    has_empresa_access(empresa_id)
    AND (
      can_manage_credenciales()
      OR EXISTS (
        SELECT 1 FROM public.app_credenciales c
        WHERE c.id = app_credencial_roles.credencial_id
          AND user_has_credencial_role(c.id, c.empresa_id)
      )
    )
  );

DROP POLICY IF EXISTS app_credencial_roles_manage_write ON public.app_credencial_roles;
CREATE POLICY app_credencial_roles_manage_write ON public.app_credencial_roles
  FOR ALL
  USING (has_empresa_access(empresa_id) AND can_manage_credenciales())
  WITH CHECK (has_empresa_access(empresa_id) AND can_manage_credenciales());
