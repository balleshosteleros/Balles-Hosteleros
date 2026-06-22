-- Plantillas de correo del pipeline de RECLUTAMIENTO por empresa.
--
-- Modelo: 10 estados canónicos (ver CHECK abajo, alineado con
-- EstadoReclutamiento en src/features/rrhh/data/reclutamiento.ts). Una fila por
-- (empresa_id, estado). Cuando un candidato cambia de estado dentro de una
-- vacante, se usa la plantilla del estado destino para avisarle por correo.
--
-- Los textos de fábrica viven en src/lib/seeds/reclutamiento-email-plantillas.ts
-- y se propagan a todas las empresas (presentes y futuras) de forma ADITIVA vía
-- syncSeedsToAllEmpresas() / seedEmpresaDefaults(). El cliente puede editar
-- asunto/cuerpo o activar/desactivar cada plantilla sin que el sync lo pise.

CREATE TABLE IF NOT EXISTS public.reclutamiento_email_plantillas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  estado      text NOT NULL,
  asunto      text NOT NULL,
  cuerpo      text NOT NULL,
  activa      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reclutamiento_email_plantillas_estado_chk CHECK (
    estado IN (
      'nuevo','elegido','entrevista','teorica','practica','prueba',
      'empleado','papelera','no_se_presenta','suspenso_formacion'
    )
  ),
  CONSTRAINT reclutamiento_email_plantillas_unq UNIQUE (empresa_id, estado)
);

CREATE INDEX IF NOT EXISTS reclutamiento_email_plantillas_empresa_idx
  ON public.reclutamiento_email_plantillas(empresa_id);

ALTER TABLE public.reclutamiento_email_plantillas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reclutamiento_email_plantillas_all ON public.reclutamiento_email_plantillas;
CREATE POLICY reclutamiento_email_plantillas_all ON public.reclutamiento_email_plantillas
  FOR ALL
  USING (public.user_has_empresa_access(empresa_id))
  WITH CHECK (public.user_has_empresa_access(empresa_id));

COMMENT ON TABLE public.reclutamiento_email_plantillas IS
  'Plantillas de correo del pipeline de Reclutamiento por empresa (una por estado del candidato).';
