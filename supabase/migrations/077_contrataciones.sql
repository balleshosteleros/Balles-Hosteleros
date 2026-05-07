-- Submódulo Contrataciones (Gestoría): altas y bajas de empleados
-- Una tabla unificada con tipo='alta'|'baja'

CREATE TABLE IF NOT EXISTS public.contrataciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('alta','baja')),

  -- ALTA fields (usadas cuando tipo='alta')
  nombre text,
  apellidos text,
  dni text,
  numero_ss text,
  fecha_comienzo date,
  nomina text,
  puesto text,
  horario_lunes text,
  horario_martes text,
  horario_miercoles text,
  horario_jueves text,
  horario_viernes text,
  horario_sabado text,
  horario_domingo text,

  -- BAJA fields (usadas cuando tipo='baja')
  empleado_id uuid REFERENCES public.empleados(id) ON DELETE SET NULL,
  fecha_finalizacion date,
  motivo text,
  motivo_otro text,
  liquidar_vacaciones boolean,
  dias_vacaciones integer,
  descontar_preaviso boolean,
  dias_preaviso integer,

  -- Email tracking
  email_to_gestoria text,
  email_to_departamento text,
  email_estado text NOT NULL DEFAULT 'pendiente'
    CHECK (email_estado IN ('pendiente','enviado','fallido')),
  email_enviado_at timestamptz,
  email_error text,

  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contrataciones_empresa_fecha
  ON public.contrataciones (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contrataciones_empresa_tipo_fecha
  ON public.contrataciones (empresa_id, tipo, created_at DESC);

ALTER TABLE public.contrataciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contrataciones_read ON public.contrataciones;
CREATE POLICY contrataciones_read ON public.contrataciones
  FOR SELECT TO authenticated
  USING (
    empresa_id IN (
      SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS contrataciones_manage ON public.contrataciones;
CREATE POLICY contrataciones_manage ON public.contrataciones
  FOR ALL TO authenticated
  USING (
    empresa_id IN (
      SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    empresa_id IN (
      SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.contrataciones_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contrataciones_updated_at ON public.contrataciones;
CREATE TRIGGER contrataciones_updated_at
  BEFORE UPDATE ON public.contrataciones
  FOR EACH ROW
  EXECUTE FUNCTION public.contrataciones_set_updated_at();
