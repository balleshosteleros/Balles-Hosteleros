-- ============================================================================
-- El escandallo del Tomahawk llevaba "Pure de patatas" como guarnición, pero tanto
-- la ficha técnica (TOMAHACK + PATATAS + PIMIENTOS) como el jefe de cocina dicen
-- que van patatas fritas. Por eso el plato declaraba Lácteos (del puré) y no el
-- Gluten que sí le corresponde por la freidora compartida.
-- Idempotente: sustituye solo si el puré sigue ahí.
-- ============================================================================
do $$
declare
  v_empresa uuid;
  v_plato   uuid;
  v_pure    uuid;
  v_fritas  uuid;
begin
  select id into v_empresa from public.empresas where nombre = 'BACANAL';
  if v_empresa is null then return; end if;

  select id into v_plato  from public.productos
    where empresa_id = v_empresa and tipo = 'venta' and nombre = 'Tomahawk';
  select id into v_pure   from public.productos
    where empresa_id = v_empresa and tipo = 'elaboracion' and nombre = 'Pure de patatas';
  select id into v_fritas from public.productos
    where empresa_id = v_empresa and tipo = 'elaboracion' and nombre = 'Patatas fritas';

  if v_plato is null or v_fritas is null then return; end if;

  delete from public.producto_composicion
   where producto_venta_id = v_plato and ingrediente_id = v_pure;

  insert into public.producto_composicion (producto_venta_id, ingrediente_id, cantidad)
  values (v_plato, v_fritas, 150)
  on conflict do nothing;
end $$;
