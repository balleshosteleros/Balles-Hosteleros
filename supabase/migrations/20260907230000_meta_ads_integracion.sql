-- ═══════════════════════════════════════════════════════════════════
-- PRP-087 · Fase 1 — Conexión de Meta por empresa
--
-- Cada empresa conecta SU propia cuenta publicitaria de Meta desde
-- Ajustes → Integraciones, pulsando "Conectar con Facebook" (OAuth).
-- Antes de esto las claves vivían en variables de entorno GLOBALES
-- (META_ACCESS_TOKEN…), o sea una sola cuenta para todas las empresas:
-- HABANA y BACANAL habrían compartido la publicidad. Aquí se separan.
--
-- El acceso va cifrado (AES-256-GCM, mismo cifrado que Accesos y Ágora)
-- y NUNCA vuelve al navegador. Se lee solo en servidor.
--
-- Idempotente: se puede aplicar varias veces sin romper nada.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.empresa_meta_config (
  empresa_id            UUID PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,

  -- Acceso de larga duración devuelto por Meta (~60 días). Cifrado.
  access_token_cifrado  TEXT,
  -- Cuándo caduca: sin esto, un día las campañas dejan de refrescarse en
  -- silencio y nadie se entera hasta que alguien mira la pantalla.
  token_expira_at       TIMESTAMPTZ,

  -- Los tres activos que se eligen de una lista leída de la API,
  -- nunca tecleados a mano.
  ad_account_id         TEXT,   -- act_123456789
  page_id               TEXT,   -- página de Facebook
  instagram_actor_id    TEXT,   -- cuenta de Instagram vinculada (puede faltar)

  -- Para enseñarlos en Ajustes sin volver a llamar a Meta.
  nombre_cuenta         TEXT,
  nombre_pagina         TEXT,
  nombre_instagram      TEXT,
  moneda                TEXT NOT NULL DEFAULT 'EUR',

  -- Tope de gasto mensual POR EMPRESA. Bloquea la activación, no avisa:
  -- alcanzado el tope no se puede activar nada más hasta subirlo a mano.
  -- En céntimos, como todo el dinero que viene de Meta.
  tope_gasto_mensual_cent BIGINT,

  activo                BOOLEAN NOT NULL DEFAULT FALSE,

  -- Auditoría: quién dejó esta cuenta conectada y cuándo.
  conectado_por         UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  conectado_at          TIMESTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Una conexión activa SIN tope de gasto no puede existir: es la garantía
  -- de que nadie pueda gastar sin límite. La comprueba la base de datos,
  -- no solo el formulario.
  CONSTRAINT empresa_meta_activo_exige_tope CHECK (
    NOT activo OR (tope_gasto_mensual_cent IS NOT NULL AND tope_gasto_mensual_cent > 0)
  ),
  -- Activa exige también los tres datos sin los que no se puede anunciar.
  CONSTRAINT empresa_meta_activo_exige_cuenta CHECK (
    NOT activo OR (access_token_cifrado IS NOT NULL AND ad_account_id IS NOT NULL AND page_id IS NOT NULL)
  )
);

COMMENT ON TABLE public.empresa_meta_config IS
  'Conexión de Meta Ads por empresa (PRP-087). El acceso va cifrado y nunca sale al navegador.';
COMMENT ON COLUMN public.empresa_meta_config.tope_gasto_mensual_cent IS
  'Tope de gasto del mes en céntimos. BLOQUEA la activación de campañas al alcanzarse.';

DROP TRIGGER IF EXISTS empresa_meta_config_set_updated_at ON public.empresa_meta_config;
CREATE TRIGGER empresa_meta_config_set_updated_at
  BEFORE UPDATE ON public.empresa_meta_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.empresa_meta_config ENABLE ROW LEVEL SECURITY;

-- Lectura: usuarios de la empresa. Escritura: solo service_role desde las
-- acciones de Ajustes, que ya comprueban el permiso del rol.
DROP POLICY IF EXISTS empresa_meta_config_select ON public.empresa_meta_config;
CREATE POLICY empresa_meta_config_select
  ON public.empresa_meta_config FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT public.empresas_del_usuario()));
