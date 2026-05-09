-- =====================================================================
-- 085_horarios_tipos_ausencia_y_fichaje.sql
-- Persistencia para RRHH Horarios:
--   - tipos_ausencia (Vacaciones, Festivo, Baja médica…)
--   - tipos_fichaje  (Entrada, Salida, Inicio pausa…)
-- Patrón: por empresa_id, RLS estilo escandallos_config_items.
-- =====================================================================

-- ──────────────────────────────────────────────────────────────────────
-- TIPOS DE AUSENCIA
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tipos_ausencia (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nombre                text NOT NULL,
  descripcion           text,
  categoria             text NOT NULL DEFAULT 'Otros',
  color                 text NOT NULL DEFAULT 'bg-slate-500',
  requiere_aprobacion   boolean NOT NULL DEFAULT true,
  requiere_justificante boolean NOT NULL DEFAULT false,
  descuenta_jornada     boolean NOT NULL DEFAULT true,
  refleja_calendario    boolean NOT NULL DEFAULT true,
  orden                 integer NOT NULL DEFAULT 0,
  activo                boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid
);

CREATE INDEX IF NOT EXISTS idx_tipos_ausencia_empresa
  ON public.tipos_ausencia (empresa_id, orden);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_tipos_ausencia_empresa_nombre
  ON public.tipos_ausencia (empresa_id, lower(nombre));

ALTER TABLE public.tipos_ausencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tipos_ausencia_read ON public.tipos_ausencia;
CREATE POLICY tipos_ausencia_read ON public.tipos_ausencia FOR SELECT
USING (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid())
);

DROP POLICY IF EXISTS tipos_ausencia_write ON public.tipos_ausencia;
CREATE POLICY tipos_ausencia_write ON public.tipos_ausencia FOR ALL
USING (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid())
)
WITH CHECK (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid())
);

DROP TRIGGER IF EXISTS trg_tipos_ausencia_updated_at ON public.tipos_ausencia;
CREATE TRIGGER trg_tipos_ausencia_updated_at
  BEFORE UPDATE ON public.tipos_ausencia
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────────────────────────────
-- TIPOS DE FICHAJE
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tipos_fichaje (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nombre          text NOT NULL,
  codigo          text NOT NULL,
  descripcion     text,
  computa_tiempo  boolean NOT NULL DEFAULT true,
  orden           integer NOT NULL DEFAULT 0,
  activo          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);

CREATE INDEX IF NOT EXISTS idx_tipos_fichaje_empresa
  ON public.tipos_fichaje (empresa_id, orden);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_tipos_fichaje_empresa_codigo
  ON public.tipos_fichaje (empresa_id, upper(codigo));

ALTER TABLE public.tipos_fichaje ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tipos_fichaje_read ON public.tipos_fichaje;
CREATE POLICY tipos_fichaje_read ON public.tipos_fichaje FOR SELECT
USING (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid())
);

DROP POLICY IF EXISTS tipos_fichaje_write ON public.tipos_fichaje;
CREATE POLICY tipos_fichaje_write ON public.tipos_fichaje FOR ALL
USING (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid())
)
WITH CHECK (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid())
);

DROP TRIGGER IF EXISTS trg_tipos_fichaje_updated_at ON public.tipos_fichaje;
CREATE TRIGGER trg_tipos_fichaje_updated_at
  BEFORE UPDATE ON public.tipos_fichaje
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────────────────────────────
-- SEED — para CADA empresa existente
-- ──────────────────────────────────────────────────────────────────────
INSERT INTO public.tipos_ausencia
  (empresa_id, nombre, descripcion, categoria, color,
   requiere_aprobacion, requiere_justificante, descuenta_jornada, refleja_calendario, orden, activo)
SELECT e.id, v.nombre, v.descripcion, v.categoria, v.color,
       v.req_aprob, v.req_just, v.desc_jor, v.ref_cal, v.orden, true
FROM public.empresas e
CROSS JOIN (VALUES
  ('Vacaciones',             'Vacaciones anuales',                 'Vacaciones',     'bg-emerald-500', true,  false, true,  true, 1),
  ('Festivo',                'Día festivo oficial',                'Festivos',       'bg-amber-500',   false, false, false, true, 2),
  ('Baja médica',            'Baja por enfermedad o accidente',    'Bajas médicas',  'bg-rose-500',    false, true,  true,  true, 3),
  ('Ausencia justificada',   'Ausencia con justificación válida',  'Justificadas',   'bg-violet-500',  true,  true,  false, true, 4),
  ('Permiso retribuido',     'Permiso con retribución',            'Justificadas',   'bg-sky-500',     true,  false, false, true, 5),
  ('Asunto personal',        'Día de asuntos propios',             'Justificadas',   'bg-teal-500',    true,  false, true,  true, 6),
  ('Ausencia no justificada','Ausencia sin justificación',         'No justificadas','bg-destructive', false, false, true,  true, 7)
) AS v(nombre, descripcion, categoria, color, req_aprob, req_just, desc_jor, ref_cal, orden)
ON CONFLICT (empresa_id, lower(nombre)) DO NOTHING;

INSERT INTO public.tipos_fichaje
  (empresa_id, nombre, codigo, descripcion, computa_tiempo, orden, activo)
SELECT e.id, v.nombre, v.codigo, v.descripcion, v.computa, v.orden, v.activo
FROM public.empresas e
CROSS JOIN (VALUES
  ('Entrada',           'ENT', 'Fichaje de entrada',                 true,  1, true),
  ('Salida',            'SAL', 'Fichaje de salida',                  true,  2, true),
  ('Inicio pausa',      'IPA', 'Inicio de pausa',                    false, 3, true),
  ('Fin pausa',         'FPA', 'Fin de pausa',                       false, 4, true),
  ('Fichaje manual',    'MAN', 'Fichaje registrado manualmente',     true,  5, true),
  ('Fichaje corregido', 'COR', 'Fichaje corregido por responsable',  true,  6, true),
  ('Fichaje validado',  'VAL', 'Fichaje validado por supervisor',    true,  7, false)
) AS v(nombre, codigo, descripcion, computa, orden, activo)
ON CONFLICT (empresa_id, upper(codigo)) DO NOTHING;
