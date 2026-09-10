-- ═══════════════════════════════════════════════════════════════════
-- PRP-087 · Fase 4 — Registro de quién toca la publicidad
--
-- Los tres puestos de Marketing pueden activar campañas, y activar gasta
-- dinero real. Sin este registro no habría forma de saber quién puso a correr
-- el presupuesto ni cuándo. No es burocracia: es lo que permite responder
-- "¿quién activó esto?" cuando llega la factura de Meta.
--
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.meta_acciones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  -- Se conserva el registro aunque el usuario se dé de baja: por eso SET NULL
  -- y no CASCADE. Borrar a quien activó no puede borrar que se activó.
  usuario_id  UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  nivel       TEXT NOT NULL CHECK (nivel IN ('campana','conjunto','anuncio')),
  meta_id     TEXT NOT NULL,
  accion      TEXT NOT NULL,   -- activar | pausar | renombrar | presupuesto | crear | programar
  detalle     JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS meta_acciones_empresa_idx ON public.meta_acciones (empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS meta_acciones_elemento_idx ON public.meta_acciones (empresa_id, meta_id);

ALTER TABLE public.meta_acciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meta_acciones_select ON public.meta_acciones;
CREATE POLICY meta_acciones_select ON public.meta_acciones FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT public.empresas_del_usuario()));

COMMENT ON TABLE public.meta_acciones IS
  'Quién activó, pausó o cambió el presupuesto de la publicidad de Meta, y cuándo (PRP-087).';

-- El registro guarda el NOMBRE del empleado, no solo su id: si causa baja y su
-- usuario se borra, `usuario_id` queda a NULL y se perdería quién activó el
-- gasto. El nombre se congela en el momento de la acción.
ALTER TABLE public.meta_acciones
  ADD COLUMN IF NOT EXISTS usuario_nombre TEXT;

COMMENT ON COLUMN public.meta_acciones.usuario_nombre IS
  'Nombre del empleado en el momento de la acción. Congelado a propósito: sobrevive a la baja del usuario.';
