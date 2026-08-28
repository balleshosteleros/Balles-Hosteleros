-- PRP-080 Fase 1: la confirmación de albaranes graba el coste en el movimiento.
--
-- La recepción de mercancía NO pasa por `registrarMovimiento`: la hace este RPC con un
-- INSERT directo, así que el coste hay que ponerlo aquí. Y es el mejor sitio para hacerlo,
-- porque el albarán sabe el precio EXACTO de esa entrega — mejor dato que cualquier
-- histórico.
--
-- ⚠️ LA TRAMPA DE LAS UNIDADES: `v_precio` es el precio de la unidad de LÍNEA (una caja,
-- una garrafa), pero al kardex entra `v_cant_stock`, que va en unidades sueltas. Guardar
-- `v_precio` a pelo inflaría ×12 el valor de un albarán en cajas de 12. Por eso:
--     coste_unitario = v_precio / v_equiv     (€ por unidad de stock)
--     valor_total    = v_precio * v_cant      (lo que costó la línea, tal cual)
--
-- Se rehace la función entera con CREATE OR REPLACE porque PL/pgSQL no permite parchear
-- un trozo. Lo único que cambia respecto a 20260818200000 es el INSERT en
-- stock_movimientos: dos columnas más. Todo lo demás es idéntico.

DO $$
DECLARE
  v_def text;
  v_nuevo text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'confirmar_albaran_transaccional';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'No existe confirmar_albaran_transaccional: revisar antes de aplicar';
  END IF;

  -- Si ya lleva el coste, no hay nada que hacer (migración idempotente).
  IF position('coste_unitario' in v_def) > 0 THEN
    RAISE NOTICE 'confirmar_albaran_transaccional ya graba el coste; no se toca';
    RETURN;
  END IF;

  v_nuevo := replace(
    v_def,
    'insert into stock_movimientos (empresa_id, producto_id, fecha, tipo, cantidad, signo,
      saldo_resultante, referencia, documento_tipo, documento_id, origen_linea_id, created_by)
    values (v_alb.empresa_id, v_prod.id, coalesce(v_alb.fecha::timestamptz, now()), ''entrada'',
      v_cant_stock, 1, v_saldo + v_cant_stock, v_alb.numero, ''albaran'', v_alb.id, v_origen, v_actor);',
    'insert into stock_movimientos (empresa_id, producto_id, fecha, tipo, cantidad, signo,
      saldo_resultante, referencia, documento_tipo, documento_id, origen_linea_id, created_by,
      coste_unitario, valor_total)
    values (v_alb.empresa_id, v_prod.id, coalesce(v_alb.fecha::timestamptz, now()), ''entrada'',
      v_cant_stock, 1, v_saldo + v_cant_stock, v_alb.numero, ''albaran'', v_alb.id, v_origen, v_actor,
      -- Coste POR UNIDAD DE STOCK: el precio de la linea entre las unidades que trae el
      -- formato. Un precio 0 (albaran sin precios teclados) se guarda como NULL: "no se
      -- sabe" y "gratis" no son lo mismo.
      case when v_precio > 0 then v_precio / nullif(coalesce(v_equiv, 1), 0) else null end,
      case when v_precio > 0 then v_precio * v_cant else null end);'
  );

  IF v_nuevo = v_def THEN
    RAISE EXCEPTION 'No se pudo localizar el INSERT de stock_movimientos: la funcion ha cambiado, revisar a mano';
  END IF;

  EXECUTE v_nuevo;
END $$;
