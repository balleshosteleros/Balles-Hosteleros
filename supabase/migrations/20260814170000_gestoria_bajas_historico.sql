-- Histórico de BAJAS avisadas a la gestoría (visor Gestoría → Contrataciones).
--
-- Contexto: `enviarBajaGestoria` envía el correo a la gestoría y termina ahí. A
-- diferencia del ALTA (que deja rastro en `gestoria_contrato_tokens` porque la
-- gestoría debe devolver el contrato firmado), la baja NO tenía registro alguno:
-- no había forma de saber a quién se había avisado, ni cuándo, ni si el correo
-- llegó a salir. Esta tabla es esa constancia.
--
-- FOTO FIJA: se guardan los datos TAL COMO SE ENVIARON en el correo (nombre,
-- puesto, fechas). No se recalculan leyendo la ficha del empleado, porque la
-- ficha cambia después y el histórico debe reflejar lo que la gestoría recibió.
--
-- Se escribe desde las DOS vías que dan de baja: RRHH → Reclutamiento y la
-- aprobación de la solicitud del empleado en Mi Panel.

CREATE TABLE IF NOT EXISTS public.gestoria_bajas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  -- El empleado puede borrarse (CASCADE en su ficha); el histórico de lo enviado
  -- a la gestoría NO debe desaparecer con él: por eso SET NULL y nombre copiado.
  empleado_id uuid REFERENCES public.empleados(id) ON DELETE SET NULL,

  -- Datos enviados (foto fija del correo)
  nombre text NOT NULL,
  dni_nie text,
  puesto text,
  tipo_baja text,
  tipo_baja_label text,
  motivo text,
  -- Último día EFECTIVO de trabajo. El día oficial de la baja es el siguiente
  -- (lo calcula el correo); se guarda el último día, que es el dato que se pacta.
  ultimo_dia date NOT NULL,

  -- Origen del aviso: por dónde se tramitó la baja.
  origen text NOT NULL DEFAULT 'reclutamiento'
    CHECK (origen IN ('reclutamiento','mi_panel')),

  -- Estado del envío. 'fallido' es el caso peligroso: la baja se tramitó pero la
  -- gestoría PUEDE no haberse enterado (el trabajador seguiría de alta en la
  -- Seguridad Social). El visor lo marca en rojo.
  email_estado text NOT NULL DEFAULT 'enviado'
    CHECK (email_estado IN ('enviado','fallido')),
  email_to text,
  email_error text,
  enviado_en timestamptz NOT NULL DEFAULT now(),

  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_gestoria_bajas_empresa_fecha
  ON public.gestoria_bajas (empresa_id, enviado_en DESC);
CREATE INDEX IF NOT EXISTS idxfk_gestoria_bajas_empleado_id
  ON public.gestoria_bajas (empleado_id);
CREATE INDEX IF NOT EXISTS idxfk_gestoria_bajas_created_by
  ON public.gestoria_bajas (created_by);

ALTER TABLE public.gestoria_bajas ENABLE ROW LEVEL SECURITY;

-- Solo LECTURA para usuarios. La escritura va siempre con service role desde el
-- servidor (el aviso a la gestoría), nunca desde el cliente: el histórico es un
-- registro de lo ocurrido, no un formulario.
DROP POLICY IF EXISTS gestoria_bajas_read ON public.gestoria_bajas;
CREATE POLICY gestoria_bajas_read ON public.gestoria_bajas
  FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT public.empresas_del_usuario()));
