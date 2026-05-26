-- ============================================================
-- 20260526200000_landing_visita.sql
--
-- "Landing de visita" — captura de leads en restaurante vía QR.
--
-- Flujo:
--   1. Cliente escanea QR (impreso en mesa/menú) → abre /v/<carta_slug>.
--   2. La landing muestra hero + carta + pop-up suave de captura
--      (nombre, email, teléfono opcional, consentimiento RGPD).
--   3. Se crea fila en `visita_leads` con un token único de reseña.
--   4. Se programa email a las 2h (default) en `visita_emails_pendientes`.
--   5. Cliente recibe email → pulsa estrellas → /r/<token>?rating=N.
--   6. La reseña se guarda en la tabla `resenas` existente (origen='carta').
--      Si rating=5 y la empresa lo ha activado → redirige a Google Reviews.
--
-- Multi-tenant: 1 fila en `visita_config` por empresa, con textos editables.
-- Todos los emails salen por la cascada SMTP que ya existe (sendEmail).
-- ============================================================

-- ─── 1. visita_config (1 fila por empresa) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visita_config (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id           uuid NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE CASCADE,

  -- Toggle global de la landing
  activado             boolean NOT NULL DEFAULT false,

  -- Branding override (si quieren algo distinto a la carta). Si NULL,
  -- la landing usa los campos `carta_hero_url`, `logo_url` y colores
  -- ya presentes en `empresas`.
  hero_url             text,

  -- Textos editables (placeholders: {nombre_empresa})
  bienvenida_titulo    text NOT NULL DEFAULT 'Bienvenidos a {nombre_empresa}',
  bienvenida_subtitulo text NOT NULL DEFAULT 'Disfruta de nuestra carta y déjanos darte recomendaciones a medida',
  popup_titulo         text NOT NULL DEFAULT '🎁 Solo para nuestros comensales',
  popup_subtitulo      text NOT NULL DEFAULT 'Suscríbete y recibe las recomendaciones del chef + un detalle en tu próxima visita',
  popup_boton_texto    text NOT NULL DEFAULT 'Suscribirme',

  -- Email follow-up (placeholders: {nombre}, {nombre_empresa})
  email_asunto         text NOT NULL DEFAULT '¿Qué tal lo pasaste en {nombre_empresa}? 🌟',
  email_cuerpo         text NOT NULL DEFAULT 'Hola {nombre},\n\nEsperamos que lo hayas pasado en grande con nosotros. ¿Nos cuentas qué te ha parecido?\n\nUn abrazo,\nEl equipo de {nombre_empresa}',
  email_delay_minutos  integer NOT NULL DEFAULT 120,  -- 2 horas

  -- Filtro 5⭐ → Google. Si activado y rating=5, la página /r/[token]
  -- redirige a Google. Si rating<5, queda interna (proteges reputación).
  redirigir_5estrellas_google boolean NOT NULL DEFAULT true,
  google_review_url    text,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT visita_config_delay_chk
    CHECK (email_delay_minutos >= 0 AND email_delay_minutos <= 60 * 24 * 7)
);

CREATE INDEX IF NOT EXISTS visita_config_empresa_idx
  ON public.visita_config(empresa_id);

ALTER TABLE public.visita_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS visita_config_all ON public.visita_config;
CREATE POLICY visita_config_all ON public.visita_config
  FOR ALL TO authenticated
  USING (public.user_has_empresa_access(empresa_id))
  WITH CHECK (public.user_has_empresa_access(empresa_id));

COMMENT ON TABLE public.visita_config IS
  'Una fila por empresa. Config editable de la landing pública /v/[slug] y del email de follow-up. Sin credenciales externas (todos los emails salen por la cascada SMTP de plataforma).';

-- ─── 2. visita_leads (captura del form) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visita_leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nombre          text NOT NULL,
  email           text,
  telefono        text,
  consentimiento  boolean NOT NULL DEFAULT false,
  -- Token único usado en el link del email para enviar la reseña.
  -- Se genera al insertar; nunca se reasigna ni rota.
  resena_token    text NOT NULL UNIQUE,
  source          text NOT NULL DEFAULT 'carta_qr',
  -- Auditoría / antiabuso
  ip_hash         text,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visita_leads_empresa_idx
  ON public.visita_leads(empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS visita_leads_email_idx
  ON public.visita_leads(email) WHERE email IS NOT NULL;

ALTER TABLE public.visita_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS visita_leads_select ON public.visita_leads;
CREATE POLICY visita_leads_select ON public.visita_leads
  FOR SELECT TO authenticated
  USING (public.user_has_empresa_access(empresa_id));
-- INSERT/UPDATE/DELETE solo service-role (endpoint público).

COMMENT ON TABLE public.visita_leads IS
  'Leads capturados en /v/[slug]. resena_token se usa en /r/[token] para asociar la reseña al cliente.';

-- ─── 3. visita_emails_pendientes (cola del cron) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.visita_emails_pendientes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  lead_id         uuid NOT NULL REFERENCES public.visita_leads(id) ON DELETE CASCADE,
  to_email        text NOT NULL,
  asunto          text NOT NULL,
  cuerpo_html     text NOT NULL,
  programado_para timestamptz NOT NULL,
  enviado         boolean NOT NULL DEFAULT false,
  enviado_at      timestamptz,
  error           text,
  intentos        integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visita_emails_due_idx
  ON public.visita_emails_pendientes(programado_para)
  WHERE enviado = false;

ALTER TABLE public.visita_emails_pendientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS visita_emails_select ON public.visita_emails_pendientes;
CREATE POLICY visita_emails_select ON public.visita_emails_pendientes
  FOR SELECT TO authenticated
  USING (public.user_has_empresa_access(empresa_id));
-- INSERT/UPDATE/DELETE solo service-role.

COMMENT ON TABLE public.visita_emails_pendientes IS
  'Cola de emails follow-up programados. El cron /api/cron/visita-emails la procesa cada minuto y manda vía sendEmail (cascada SMTP).';

-- ─── 4. Trigger updated_at en visita_config ───────────────────────────────
DROP TRIGGER IF EXISTS visita_config_set_updated_at ON public.visita_config;
CREATE TRIGGER visita_config_set_updated_at
  BEFORE UPDATE ON public.visita_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
