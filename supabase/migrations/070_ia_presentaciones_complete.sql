-- ============================================================
-- 070_ia_presentaciones_complete.sql
-- Módulo Dirección → submódulo Presentaciones.
-- 
-- Este archivo contiene las 3 tablas requeridas por el feature de 
-- presentaciones con IA (Gemini 2.0 Flash) y branding corporativo.
--
-- TABLAS:
--   - empresa_branding      : identidad visual persistente por empresa
--   - presentaciones        : biblioteca de presentaciones (incluye titulo y nombre)
--   - presentacion_slides   : slides individuales con layouts flexibles
-- ============================================================

-- 1. BRANDING POR EMPRESA
CREATE TABLE IF NOT EXISTS public.empresa_branding (
  empresa_id        uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  logo_url          text,                              -- URL en Supabase Storage
  color_primario    text NOT NULL DEFAULT '#0F172A',
  color_secundario  text NOT NULL DEFAULT '#3B82F6',
  color_fondo       text NOT NULL DEFAULT '#FFFFFF',
  color_texto       text NOT NULL DEFAULT '#0F172A',
  tipografia_titulo text NOT NULL DEFAULT 'Inter',
  tipografia_cuerpo text NOT NULL DEFAULT 'Inter',
  fondo_url         text,                              -- Imagen de fondo opcional
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 2. PRESENTACIONES (Biblioteca Inteligente)
-- Nota: Se incluyen tanto 'titulo' como 'nombre' para compatibilidad total.
CREATE TABLE IF NOT EXISTS public.presentaciones (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

  -- Metadatos
  titulo            text NOT NULL,                     -- Usado por la UI de Dirección
  nombre            text,                              -- Usado por compatibilidad/Gestoría
  prompt_original   text NOT NULL,
  audiencia         text,
  tono              text NOT NULL DEFAULT 'formal'
                      CHECK (tono IN ('formal','cercano','motivacional','tecnico')),
  idioma            text NOT NULL DEFAULT 'es',
  num_slides        integer NOT NULL DEFAULT 10 CHECK (num_slides BETWEEN 3 AND 30),

  -- Estado
  estado            text NOT NULL DEFAULT 'borrador'
                      CHECK (estado IN ('borrador','generando','listo','fallida','archivada')),
  error_mensaje     text,

  -- Metadatos IA
  modelo_ia         text DEFAULT 'gemini-2.0-flash',
  tokens_input      integer,
  tokens_output     integer,

  -- Snapshot del branding al momento de generar
  branding_snapshot jsonb NOT NULL DEFAULT '{}',

  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 3. SLIDES DE PRESENTACIÓN
CREATE TABLE IF NOT EXISTS public.presentacion_slides (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentacion_id uuid NOT NULL REFERENCES public.presentaciones(id) ON DELETE CASCADE,
  orden           integer NOT NULL,
  layout          text NOT NULL DEFAULT 'bullets'
                    CHECK (layout IN ('portada','bullets','cita','comparacion','imagen','cierre')),
  titulo          text,
  contenido       jsonb NOT NULL DEFAULT '{}',   -- { bullets: [], cuerpo, cita, etc. }
  notas           text,                          -- Notas del ponente
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (presentacion_id, orden)
);

-- 4. RLS - SEGURIDAD POR EMPRESA
ALTER TABLE public.empresa_branding      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentaciones        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentacion_slides   ENABLE ROW LEVEL SECURITY;

-- Empresa Branding
DROP POLICY IF EXISTS "brand_read" ON public.empresa_branding;
CREATE POLICY "brand_read" ON public.empresa_branding FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid()));

DROP POLICY IF EXISTS "brand_manage" ON public.empresa_branding;
CREATE POLICY "brand_manage" ON public.empresa_branding FOR ALL TO authenticated
  USING (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid()))
  WITH CHECK (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid()));

-- Presentaciones
DROP POLICY IF EXISTS "pres_read" ON public.presentaciones;
CREATE POLICY "pres_read" ON public.presentaciones FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid()));

DROP POLICY IF EXISTS "pres_manage" ON public.presentaciones;
CREATE POLICY "pres_manage" ON public.presentaciones FOR ALL TO authenticated
  USING (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid()))
  WITH CHECK (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid()));

-- Slides
DROP POLICY IF EXISTS "slides_read" ON public.presentacion_slides;
CREATE POLICY "slides_read" ON public.presentacion_slides FOR SELECT TO authenticated
  USING (presentacion_id IN (
    SELECT id FROM public.presentaciones pr
    WHERE pr.empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())
  ));

DROP POLICY IF EXISTS "slides_manage" ON public.presentacion_slides;
CREATE POLICY "slides_manage" ON public.presentacion_slides FOR ALL TO authenticated
  USING (presentacion_id IN (
    SELECT id FROM public.presentaciones pr
    WHERE pr.empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())
  ))
  WITH CHECK (presentacion_id IN (
    SELECT id FROM public.presentaciones pr
    WHERE pr.empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.user_id = auth.uid())
  ));

-- 5. SEED INICIAL DE BRANDING
INSERT INTO public.empresa_branding (empresa_id)
SELECT id FROM public.empresas
ON CONFLICT (empresa_id) DO NOTHING;
