-- AUDITORÍAS de departamento (módulo Dirección).
--
-- Modelo elegido: UNA auditoría por (empresa, departamento, mes 'YYYY-MM').
-- Cada auditoría es el guion de la reunión mensual con ese departamento:
--   · una lista de PUNTOS clasificados por tipo (incidencia, notificación,
--     problemática, mejora), con severidad y estado de resolución,
--   · una VALORACIÓN global del mes (bien / regular / atención),
--   · la fecha de la reunión y las NOTAS de lo hablado.
--
-- Se usa para valorar mes a mes cómo va el negocio en cada departamento.
-- Multi-tenant: todo filtra por empresa_id y la RLS usa el helper
-- user_has_empresa_access(empresa_id) (mismo patrón que reclutamiento).

-- ─── Cabecera: una auditoría por departamento y mes ──────────────────────────
CREATE TABLE IF NOT EXISTS public.auditorias (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  departamento_id uuid NOT NULL REFERENCES public.departamentos(id) ON DELETE CASCADE,
  periodo         text NOT NULL,                          -- 'YYYY-MM'
  valoracion      text,                                   -- null = sin valorar
  fecha_reunion   date,
  notas_reunion   text NOT NULL DEFAULT '',
  estado          text NOT NULL DEFAULT 'borrador',       -- borrador | cerrada
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auditorias_periodo_chk CHECK (periodo ~ '^[0-9]{4}-[0-9]{2}$'),
  CONSTRAINT auditorias_valoracion_chk CHECK (
    valoracion IS NULL OR valoracion IN ('bien','regular','atencion')
  ),
  CONSTRAINT auditorias_estado_chk CHECK (estado IN ('borrador','cerrada')),
  CONSTRAINT auditorias_unq UNIQUE (empresa_id, departamento_id, periodo)
);

CREATE INDEX IF NOT EXISTS auditorias_empresa_periodo_idx
  ON public.auditorias(empresa_id, periodo DESC);
CREATE INDEX IF NOT EXISTS auditorias_departamento_idx
  ON public.auditorias(departamento_id);

ALTER TABLE public.auditorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auditorias_all ON public.auditorias;
CREATE POLICY auditorias_all ON public.auditorias
  FOR ALL
  USING (public.user_has_empresa_access(empresa_id))
  WITH CHECK (public.user_has_empresa_access(empresa_id));

COMMENT ON TABLE public.auditorias IS
  'Auditoría mensual por departamento (módulo Dirección): valoración + notas de la reunión.';

-- ─── Puntos: incidencias, notificaciones, problemáticas y mejoras ────────────
CREATE TABLE IF NOT EXISTS public.auditoria_puntos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  auditoria_id  uuid NOT NULL REFERENCES public.auditorias(id) ON DELETE CASCADE,
  tipo          text NOT NULL,                            -- ver CHECK
  titulo        text NOT NULL,
  descripcion   text NOT NULL DEFAULT '',
  severidad     text NOT NULL DEFAULT 'media',            -- baja | media | alta
  estado        text NOT NULL DEFAULT 'abierto',          -- abierto | en_curso | resuelto
  responsable   text NOT NULL DEFAULT '',
  orden         integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auditoria_puntos_tipo_chk CHECK (
    tipo IN ('incidencia','notificacion','problematica','mejora')
  ),
  CONSTRAINT auditoria_puntos_severidad_chk CHECK (severidad IN ('baja','media','alta')),
  CONSTRAINT auditoria_puntos_estado_chk CHECK (estado IN ('abierto','en_curso','resuelto'))
);

CREATE INDEX IF NOT EXISTS auditoria_puntos_auditoria_idx
  ON public.auditoria_puntos(auditoria_id, orden);
CREATE INDEX IF NOT EXISTS auditoria_puntos_empresa_idx
  ON public.auditoria_puntos(empresa_id);

ALTER TABLE public.auditoria_puntos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auditoria_puntos_all ON public.auditoria_puntos;
CREATE POLICY auditoria_puntos_all ON public.auditoria_puntos
  FOR ALL
  USING (public.user_has_empresa_access(empresa_id))
  WITH CHECK (public.user_has_empresa_access(empresa_id));

COMMENT ON TABLE public.auditoria_puntos IS
  'Puntos de una auditoría: incidencias, notificaciones, problemáticas y mejoras por departamento.';
