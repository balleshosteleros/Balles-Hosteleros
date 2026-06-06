-- PRP-052 — Cupones de sala (Fase 1)
-- DROP/RECREATE de reserva_codigos con el modelo nuevo (etiqueta informativa,
-- código auto 6 chars, 3 tipos de beneficio, stock por reservas o personas,
-- restricciones por días/turnos/caducidad). Producción vacía en 2026-06-03.

ALTER TABLE public.reservas DROP CONSTRAINT IF EXISTS reservas_codigo_id_fkey;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='reservas' AND column_name='codigo_nombre'
  ) THEN
    ALTER TABLE public.reservas RENAME COLUMN codigo_nombre TO codigo;
  END IF;
END$$;

DROP TABLE IF EXISTS public.reserva_codigos CASCADE;

CREATE TABLE public.reserva_codigos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo                TEXT NOT NULL CHECK (codigo ~ '^[A-Z0-9]{6}$'),
  titulo_interno        TEXT NOT NULL CHECK (length(titulo_interno) BETWEEN 1 AND 120),
  titulo_cliente        TEXT NULL CHECK (titulo_cliente IS NULL OR length(titulo_cliente) BETWEEN 1 AND 120),
  beneficio_tipo        TEXT NOT NULL CHECK (beneficio_tipo IN ('porcentaje','importe','producto_gratis')),
  beneficio_valor       NUMERIC(10,2) NULL,
  producto_descripcion  TEXT NULL CHECK (producto_descripcion IS NULL OR length(producto_descripcion) BETWEEN 1 AND 200),
  unidad_stock          TEXT NOT NULL CHECK (unidad_stock IN ('reservas','personas')),
  stock_total           INT NOT NULL CHECK (stock_total >= 1),
  stock_consumido       INT NOT NULL DEFAULT 0 CHECK (stock_consumido >= 0),
  fecha_caducidad       DATE NULL,
  dias_semana           TEXT[] NOT NULL DEFAULT ARRAY['lun','mar','mie','jue','vie','sab','dom']::TEXT[],
  turnos                TEXT[] NOT NULL DEFAULT ARRAY['COMIDA','CENA']::TEXT[],
  activo                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cupon_beneficio_coherente CHECK (
    (beneficio_tipo = 'porcentaje'         AND beneficio_valor BETWEEN 1 AND 100 AND producto_descripcion IS NULL)
    OR (beneficio_tipo = 'importe'         AND beneficio_valor >= 0              AND producto_descripcion IS NULL)
    OR (beneficio_tipo = 'producto_gratis' AND beneficio_valor IS NULL           AND producto_descripcion IS NOT NULL)
  ),
  CONSTRAINT cupon_stock_no_supera_total CHECK (stock_consumido <= stock_total),
  CONSTRAINT cupon_codigo_unico_empresa UNIQUE (empresa_id, codigo)
);

CREATE INDEX reserva_codigos_empresa_idx        ON public.reserva_codigos(empresa_id);
CREATE INDEX reserva_codigos_empresa_codigo_idx ON public.reserva_codigos(empresa_id, codigo);

ALTER TABLE public.reservas
  ADD CONSTRAINT reservas_codigo_id_fkey
    FOREIGN KEY (codigo_id) REFERENCES public.reserva_codigos(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS reserva_codigos_set_updated_at ON public.reserva_codigos;
CREATE TRIGGER reserva_codigos_set_updated_at
  BEFORE UPDATE ON public.reserva_codigos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.reserva_codigos ENABLE ROW LEVEL SECURITY;

CREATE POLICY reserva_codigos_select_empresa
  ON public.reserva_codigos FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT public.empresas_del_usuario()));

CREATE POLICY reserva_codigos_insert_empresa
  ON public.reserva_codigos FOR INSERT TO authenticated
  WITH CHECK (empresa_id IN (SELECT public.empresas_del_usuario()));

CREATE POLICY reserva_codigos_update_empresa
  ON public.reserva_codigos FOR UPDATE TO authenticated
  USING (empresa_id IN (SELECT public.empresas_del_usuario()))
  WITH CHECK (empresa_id IN (SELECT public.empresas_del_usuario()));

CREATE POLICY reserva_codigos_delete_empresa
  ON public.reserva_codigos FOR DELETE TO authenticated
  USING (empresa_id IN (SELECT public.empresas_del_usuario()));

-- RPC generadora de código único por empresa
CREATE OR REPLACE FUNCTION public.generar_codigo_cupon(p_empresa_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_chars    TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  v_code     TEXT;
  v_attempt  INT := 0;
  i          INT;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(v_chars, floor(random() * 36)::INT + 1, 1);
    END LOOP;
    IF NOT EXISTS (
      SELECT 1 FROM public.reserva_codigos
      WHERE empresa_id = p_empresa_id AND codigo = v_code
    ) THEN
      RETURN v_code;
    END IF;
    v_attempt := v_attempt + 1;
    IF v_attempt > 50 THEN
      RAISE EXCEPTION 'No se pudo generar código único tras 50 intentos';
    END IF;
  END LOOP;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.generar_codigo_cupon(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.generar_codigo_cupon(UUID) TO authenticated, service_role;
