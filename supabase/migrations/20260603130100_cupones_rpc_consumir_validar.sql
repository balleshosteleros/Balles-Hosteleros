-- PRP-052 — Cupones de sala (Fase 2)
-- RPCs consumir_stock_cupon (atómica, solo service_role) y validar_cupon
-- (pública, no expone stock).

CREATE OR REPLACE FUNCTION public.consumir_stock_cupon(
  p_codigo_id UUID,
  p_personas  INT
) RETURNS public.reserva_codigos
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_row     public.reserva_codigos;
  v_consume INT;
BEGIN
  IF p_personas < 1 THEN
    RAISE EXCEPTION 'personas inválidas';
  END IF;

  SELECT * INTO v_row FROM public.reserva_codigos WHERE id = p_codigo_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'NO_EXISTE' USING ERRCODE = 'P0001'; END IF;
  IF NOT v_row.activo THEN RAISE EXCEPTION 'INACTIVO' USING ERRCODE = 'P0001'; END IF;

  v_consume := CASE WHEN v_row.unidad_stock = 'personas' THEN p_personas ELSE 1 END;
  IF v_row.stock_consumido + v_consume > v_row.stock_total THEN
    RAISE EXCEPTION 'AGOTADO' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.reserva_codigos
     SET stock_consumido = stock_consumido + v_consume,
         updated_at      = NOW()
   WHERE id = p_codigo_id
   RETURNING * INTO v_row;
  RETURN v_row;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.consumir_stock_cupon(UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.consumir_stock_cupon(UUID, INT) TO service_role;


CREATE OR REPLACE FUNCTION public.validar_cupon(
  p_empresa_id UUID,
  p_codigo     TEXT,
  p_fecha      DATE,
  p_turno      TEXT
) RETURNS TABLE (
  ok                       BOOLEAN,
  motivo                   TEXT,
  cupon_id                 UUID,
  titulo_cliente_efectivo  TEXT,
  beneficio_tipo           TEXT,
  beneficio_valor          NUMERIC,
  producto_descripcion     TEXT,
  fecha_caducidad          DATE
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v             public.reserva_codigos;
  v_dia_key     TEXT;
  v_codigo_norm TEXT;
BEGIN
  v_codigo_norm := UPPER(regexp_replace(COALESCE(p_codigo,''), '\s+', '', 'g'));
  IF v_codigo_norm !~ '^[A-Z0-9]{6}$' THEN
    RETURN QUERY SELECT FALSE, 'NO_EXISTE', NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::NUMERIC, NULL::TEXT, NULL::DATE;
    RETURN;
  END IF;

  SELECT * INTO v FROM public.reserva_codigos
    WHERE empresa_id = p_empresa_id AND codigo = v_codigo_norm LIMIT 1;
  IF v.id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'NO_EXISTE', NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::NUMERIC, NULL::TEXT, NULL::DATE;
    RETURN;
  END IF;
  IF NOT v.activo THEN
    RETURN QUERY SELECT FALSE, 'INACTIVO', v.id, COALESCE(v.titulo_cliente, v.titulo_interno),
      v.beneficio_tipo, v.beneficio_valor, v.producto_descripcion, v.fecha_caducidad;
    RETURN;
  END IF;
  IF v.fecha_caducidad IS NOT NULL AND p_fecha > v.fecha_caducidad THEN
    RETURN QUERY SELECT FALSE, 'CADUCADO', v.id, COALESCE(v.titulo_cliente, v.titulo_interno),
      v.beneficio_tipo, v.beneficio_valor, v.producto_descripcion, v.fecha_caducidad;
    RETURN;
  END IF;
  v_dia_key := (ARRAY['dom','lun','mar','mie','jue','vie','sab'])[EXTRACT(DOW FROM p_fecha)::INT + 1];
  IF NOT (v_dia_key = ANY (v.dias_semana)) THEN
    RETURN QUERY SELECT FALSE, 'DIA_NO_PERMITIDO', v.id, COALESCE(v.titulo_cliente, v.titulo_interno),
      v.beneficio_tipo, v.beneficio_valor, v.producto_descripcion, v.fecha_caducidad;
    RETURN;
  END IF;
  IF p_turno IS NOT NULL AND NOT (p_turno = ANY (v.turnos)) THEN
    RETURN QUERY SELECT FALSE, 'TURNO_NO_PERMITIDO', v.id, COALESCE(v.titulo_cliente, v.titulo_interno),
      v.beneficio_tipo, v.beneficio_valor, v.producto_descripcion, v.fecha_caducidad;
    RETURN;
  END IF;
  IF v.stock_consumido >= v.stock_total THEN
    RETURN QUERY SELECT FALSE, 'AGOTADO', v.id, COALESCE(v.titulo_cliente, v.titulo_interno),
      v.beneficio_tipo, v.beneficio_valor, v.producto_descripcion, v.fecha_caducidad;
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, NULL::TEXT, v.id, COALESCE(v.titulo_cliente, v.titulo_interno),
    v.beneficio_tipo, v.beneficio_valor, v.producto_descripcion, v.fecha_caducidad;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.validar_cupon(UUID, TEXT, DATE, TEXT) TO anon, authenticated;
