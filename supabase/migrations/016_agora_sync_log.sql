-- Migración 016: Tabla de registro de sincronizaciones con Ágora POS
-- Auditoría completa de cada intento de sync: estado, errores, datos de ventas.
--
-- Relacionada con:
--   - src/features/logistica/services/agora-sync.ts
--   - src/features/logistica/actions/agora-actions.ts
--   - Regla Seguridad Ágora: .claude/memory/feedback/regla_seguridad_agora.md

CREATE TABLE IF NOT EXISTS public.agora_sync_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     UUID        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

  -- Timestamp del intento de sincronización
  sync_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Estado del sync: ok | partial | timeout | error
  status         TEXT        NOT NULL CHECK (status IN ('ok', 'partial', 'timeout', 'error')),

  -- Mensaje de error legible (vacío si status = 'ok')
  error_message  TEXT,

  -- Datos de ventas recibidos de Ágora (el payload completo o parcial)
  sales_data     JSONB,

  -- Detalle de errores por registro (array de { registro, motivo, campo })
  error_detail   JSONB,

  -- Contadores de registros procesados
  total_records  INT         NOT NULL DEFAULT 0,
  ok_records     INT         NOT NULL DEFAULT 0,
  error_records  INT         NOT NULL DEFAULT 0,
  retry_count    INT         NOT NULL DEFAULT 0,

  created_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Índice para consultas frecuentes: últimos logs por empresa, ordenados por fecha
CREATE INDEX IF NOT EXISTS idx_agora_sync_log_empresa_at
  ON public.agora_sync_log (empresa_id, sync_at DESC);

-- RLS: cada empresa solo ve sus propios registros de sync
ALTER TABLE public.agora_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresa_propia_sync_log" ON public.agora_sync_log
  FOR ALL
  USING (
    empresa_id IN (
      SELECT empresa_id
      FROM public.profiles
      WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.agora_sync_log IS
  'Registro de auditoría de cada sincronización con Ágora POS. '
  'Campos clave: status (ok/partial/timeout/error), error_message (texto legible), '
  'sales_data (payload JSONB de Ágora), error_detail (errores por registro).';
