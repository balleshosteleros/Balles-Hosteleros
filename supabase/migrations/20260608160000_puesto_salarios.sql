-- ============================================================================
-- Salario ligado al puesto (modelo: departamentos -> puestos -> puesto_salarios)
--   1. puestos.departamento_id pasa a obligatorio (todo puesto cuelga de un depto)
--   2. puesto_salarios: 1 salario vigente por puesto (1:1), por empresa, con RLS
-- ============================================================================

BEGIN;

-- 1. Departamento obligatorio en puestos (tabla vacía hoy → seguro)
ALTER TABLE public.puestos ALTER COLUMN departamento_id SET NOT NULL;

-- 2. Tabla de salarios ligada 100% al puesto
CREATE TABLE public.puesto_salarios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  puesto_id       uuid NOT NULL REFERENCES public.puestos(id)  ON DELETE CASCADE,
  nomina_neta     numeric(10,2) NOT NULL DEFAULT 0,
  efectivo_extra  numeric(10,2) NOT NULL DEFAULT 0,
  salario_neto    numeric(10,2) NOT NULL DEFAULT 0,
  jornada_contrato text,
  horas_semanales numeric(5,2),
  dias_libres     integer,
  vacaciones      text,
  horario_semanal jsonb NOT NULL DEFAULT '[]'::jsonb,
  observaciones   text,
  objetivos       jsonb NOT NULL DEFAULT '[]'::jsonb,
  estado          text NOT NULL DEFAULT 'borrador'
                    CHECK (estado IN ('activo','borrador','inactivo')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT puesto_salarios_puesto_unico UNIQUE (puesto_id)
);

CREATE INDEX idx_puesto_salarios_empresa ON public.puesto_salarios(empresa_id);

ALTER TABLE public.puesto_salarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY puesto_salarios_select ON public.puesto_salarios FOR SELECT
  USING (empresa_id IN (SELECT public.empresas_del_usuario()));
CREATE POLICY puesto_salarios_insert ON public.puesto_salarios FOR INSERT
  WITH CHECK (empresa_id IN (SELECT public.empresas_del_usuario()));
CREATE POLICY puesto_salarios_update ON public.puesto_salarios FOR UPDATE
  USING (empresa_id IN (SELECT public.empresas_del_usuario()))
  WITH CHECK (empresa_id IN (SELECT public.empresas_del_usuario()));
CREATE POLICY puesto_salarios_delete ON public.puesto_salarios FOR DELETE
  USING (empresa_id IN (SELECT public.empresas_del_usuario()));

CREATE TRIGGER tg_puesto_salarios_touch BEFORE UPDATE ON public.puesto_salarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
