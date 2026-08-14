-- Documentos OFICIALES que acreditan la baja, subidos por la GESTORÍA.
--
-- Qué se le pide (y por qué):
--   1) JUSTIFICANTE DE BAJA (sistema RED / TA.2-S) — OBLIGATORIO. Es el que
--      acredita la baja ante la Seguridad Social: lleva la FECHA exacta y el
--      CÓDIGO DE LA CAUSA (voluntaria, despido, fin de contrato…). Es la prueba
--      oficial que la empresa debe archivar.
--   2) CERTIFICADO DE EMPRESA (SEPE) — OPCIONAL. Lo presenta la gestoría al SEPE
--      para que el trabajador pueda pedir el paro; la empresa suele recibir copia.
--      No bloquea: si la gestoría solo sube el justificante, la baja se da por
--      documentada.
--
-- Ninguno de los dos los FIRMA el trabajador: son actos entre empresa y
-- Administración. El único documento de la salida que se firma es el finiquito,
-- que llega por el circuito de NÓMINAS (rrhh_pagos_nominas), no por aquí.
--
-- Mismo patrón, ya probado, que la subida del contrato en el alta
-- (`gestoria_contrato_tokens`): token hash-only + enlace público + recordatorio.

CREATE TABLE IF NOT EXISTS public.gestoria_baja_doc_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  empleado_id uuid NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  -- Baja del histórico que originó la petición (para pintar el estado en el visor).
  baja_id uuid REFERENCES public.gestoria_bajas(id) ON DELETE SET NULL,

  -- El token en claro NUNCA se persiste (igual que en contratos): solo su hash.
  token_hash text NOT NULL,
  expira_en timestamptz NOT NULL,

  -- Fecha de la baja: la usa el cron para avisar UN DÍA ANTES.
  ultimo_dia date NOT NULL,

  solicitado_en timestamptz NOT NULL DEFAULT now(),
  -- Recordatorio «un día antes» (y el de vencido: ver el cron).
  recordatorio_en timestamptz,

  -- Documento 1: justificante de baja (RED). Obligatorio.
  justificante_path text,
  justificante_subido_en timestamptz,
  -- Documento 2: certificado de empresa (SEPE). Opcional.
  certificado_path text,
  certificado_subido_en timestamptz,

  -- Copia enviada al trabajador a su email personal (el último día puede que ya
  -- no tenga acceso al sistema, así que el correo es la única vía).
  enviado_trabajador_en timestamptz,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gestoria_baja_doc_tokens_hash
  ON public.gestoria_baja_doc_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_gestoria_baja_doc_tokens_empresa
  ON public.gestoria_baja_doc_tokens (empresa_id, solicitado_en DESC);
CREATE INDEX IF NOT EXISTS idxfk_gestoria_baja_doc_tokens_empleado
  ON public.gestoria_baja_doc_tokens (empleado_id);
CREATE INDEX IF NOT EXISTS idxfk_gestoria_baja_doc_tokens_baja
  ON public.gestoria_baja_doc_tokens (baja_id);
-- Barrido del cron: pendientes de documentar, por fecha de baja.
CREATE INDEX IF NOT EXISTS idx_gestoria_baja_doc_tokens_pendientes
  ON public.gestoria_baja_doc_tokens (ultimo_dia)
  WHERE justificante_subido_en IS NULL;

ALTER TABLE public.gestoria_baja_doc_tokens ENABLE ROW LEVEL SECURITY;

-- Solo LECTURA para usuarios (el visor). La escritura va siempre con service
-- role: la crea el aviso de baja y la actualiza la subida pública de la gestoría.
DROP POLICY IF EXISTS gestoria_baja_doc_tokens_read ON public.gestoria_baja_doc_tokens;
CREATE POLICY gestoria_baja_doc_tokens_read ON public.gestoria_baja_doc_tokens
  FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT public.empresas_del_usuario()));

-- Bucket PRIVADO para los documentos de baja (staging de lo que sube la
-- gestoría). La copia definitiva se archiva en la carpeta del trabajador
-- (`empleados-docs` + `documentos_empleado`).
INSERT INTO storage.buckets (id, name, public)
VALUES ('bajas-gestoria', 'bajas-gestoria', false)
ON CONFLICT (id) DO NOTHING;
