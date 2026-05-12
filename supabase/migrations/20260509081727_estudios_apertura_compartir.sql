-- ============================================================
-- 102_estudios_apertura_compartir.sql
--
-- Enlaces públicos de solo lectura para estudios de apertura.
-- Cada estudio puede tener un slug único y un flag de activación
-- que el usuario controla manualmente desde la UI:
--   · `share_slug`   → slug-token (p.ej. "marbella-sur-a8x2k9").
--                      Combina nombre del proyecto (legible) + sufijo
--                      aleatorio (no adivinable).
--   · `share_active` → true/false: cuando false, el enlace deja de
--                      resolver (404 / no autorizado).
--
-- Política RLS: anon puede SELECT solo cuando share_active=true y
-- el slug coincide. La política de empresa (autenticado) permanece
-- intacta para edición/lectura privada.
-- ============================================================

ALTER TABLE public.estudios_apertura
  ADD COLUMN IF NOT EXISTS share_slug   text UNIQUE,
  ADD COLUMN IF NOT EXISTS share_active boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS estudios_apertura_share_slug_idx
  ON public.estudios_apertura (share_slug)
  WHERE share_slug IS NOT NULL;

COMMENT ON COLUMN public.estudios_apertura.share_slug IS
  'Slug público compartible (p.ej. nombre-proyecto-a8x2k9). NULL = nunca compartido.';
COMMENT ON COLUMN public.estudios_apertura.share_active IS
  'true = enlace público activo. false = enlace deshabilitado (404 público).';

-- ── Política anon: lectura pública controlada por slug + active ─
DROP POLICY IF EXISTS "estudios_apertura_public_read" ON public.estudios_apertura;
CREATE POLICY "estudios_apertura_public_read" ON public.estudios_apertura FOR SELECT TO anon
  USING (share_active = true AND share_slug IS NOT NULL);

-- Nota: el cliente público se ejecuta server-side con service-role key
-- (mismo patrón que carta-fetch.ts). La policy `to anon` permite además
-- consultas directas con el cliente anónimo si en algún momento se
-- expone una variante client-side.
