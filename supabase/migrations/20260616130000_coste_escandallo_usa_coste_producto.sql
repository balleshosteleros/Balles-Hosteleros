-- PRP-057 Fase 1: el coste del escandallo debe salir de productos.coste (text con €/unidad_uso),
-- ya que ingredientes_proveedor está vacía. ingredientes_proveedor.precio_unitario queda como
-- override opcional cuando exista un precio de proveedor preferido.
CREATE OR REPLACE FUNCTION public.coste_escandallo(p_producto_venta_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(round(sum(
    e.cantidad * (1 + coalesce(e.merma_pct,0) / 100)
    * coalesce(
        ip.precio_unitario,
        case when ing.coste ~ '^[0-9]+(\.[0-9]+)?$' then ing.coste::numeric else 0 end,
        0
      )
    / coalesce(nullif(ing.factor_conversion, 0), 1)
  ), 4), 0)
  from public.producto_composicion e
  join public.productos ing on ing.id = e.ingrediente_id
  left join public.ingredientes_proveedor ip
    on ip.producto_id = e.ingrediente_id and ip.es_preferido = true
  where e.producto_venta_id = p_producto_venta_id;
$function$;
