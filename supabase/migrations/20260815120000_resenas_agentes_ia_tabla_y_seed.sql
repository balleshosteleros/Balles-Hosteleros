-- Agentes IA de reseñas: versionar la tabla que faltaba en el repo (2026-08-15).
--
-- La tabla `resenas_agentes_ia` existía en producción pero NUNCA tuvo migración
-- versionada: se creó a mano fuera del repo. Eso significa que una instalación
-- limpia (o un entorno nuevo) se rompía al llegar al módulo de reseñas.
-- Aquí se deja escrita tal y como está hoy en producción.
--
-- Un agente define CÓMO contesta la IA a una reseña: a qué rango de estrellas
-- aplica, con qué tono, en qué idioma y con qué pie de página. Sin agentes la
-- IA no redacta NADA — mira la reseña, no encuentra quién la cubra y la salta.
-- Ese era el motivo real de que BACANAL y HABANA acumularan 22 reseñas de
-- Google sin contestar desde que se activó la sincronización.
--
-- El CONTENIDO de los agentes NO se siembra aquí, sino desde el manifiesto
-- canónico `src/lib/seeds/resenas-agentes-ia.ts`, como el resto de seeds del
-- software (aditivo, respeta lo que el cliente haya personalizado).
--
-- Idempotente: se puede ejecutar las veces que haga falta.

CREATE TABLE IF NOT EXISTS public.resenas_agentes_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  instrucciones text NOT NULL,
  -- Máximo 2 tonos (límite de la UI). Ver TONO_OPCIONES en types/resenas.ts.
  tonos text[] NOT NULL DEFAULT '{}'::text[],
  -- 'dinamico' = responde en el mismo idioma que la reseña original.
  idioma text NOT NULL DEFAULT 'dinamico',
  -- Rango de estrellas que cubre. Si varios agentes matchean una reseña gana
  -- el más específico (el que cubre menos estrellas).
  tipo_resena text NOT NULL DEFAULT 'todas',
  fuente text NOT NULL DEFAULT 'google',
  -- Texto fijo que se añade al final de cada respuesta. NULL = sin pie.
  pie_pagina text,
  -- Tope de borradores al día por agente: evita que un pico de reseñas
  -- dispare el gasto de IA sin control.
  max_dia integer NOT NULL DEFAULT 50,
  activo boolean NOT NULL DEFAULT true,
  creado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS resenas_agentes_ia_empresa_idx
  ON public.resenas_agentes_ia (empresa_id);

CREATE INDEX IF NOT EXISTS idxfk_resenas_agentes_ia_creado_por
  ON public.resenas_agentes_ia (creado_por);

-- ─── RLS: cada empresa ve solo sus agentes ──────────────────────────────────
ALTER TABLE public.resenas_agentes_ia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resenas_agentes_ia_read ON public.resenas_agentes_ia;
CREATE POLICY resenas_agentes_ia_read
  ON public.resenas_agentes_ia
  FOR SELECT
  USING (empresa_id IN (SELECT empresas_del_usuario()));

DROP POLICY IF EXISTS resenas_agentes_ia_write ON public.resenas_agentes_ia;
CREATE POLICY resenas_agentes_ia_write
  ON public.resenas_agentes_ia
  FOR ALL
  USING (empresa_id IN (SELECT empresas_del_usuario()))
  WITH CHECK (empresa_id IN (SELECT empresas_del_usuario()));

COMMENT ON TABLE public.resenas_agentes_ia IS
  'Agentes IA que redactan las respuestas a reseñas. Sin al menos un agente activo, la IA no genera ningún borrador. Se siembran desde src/lib/seeds/resenas-agentes-ia.ts.';
COMMENT ON COLUMN public.resenas_agentes_ia.tipo_resena IS
  'Rango de estrellas que cubre el agente. Si varios matchean, gana el más específico.';
COMMENT ON COLUMN public.resenas_agentes_ia.max_dia IS
  'Tope de borradores diarios del agente. Freno de gasto de IA ante un pico de reseñas.';
