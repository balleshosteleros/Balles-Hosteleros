-- ============================================================================
-- Había dos fichas para el servicio de pan:
--   · "Servicio Pan"    → agora_id 1909, 238 ventas reales, pero NO estaba en la carta.
--   · "Servicio de pan" → sin agora_id, 0 ventas, pero SÍ era la publicada en la carta.
-- La buena es la que vende. Se pasa la ficha de carta a "Servicio Pan", se le
-- marca el gluten y se hace visible; después se borra la duplicada.
-- "Servicio Pan Sin Gluten" (2 ventas) NO se toca: es un producto distinto y real.
-- Idempotente.
-- ============================================================================
do $$
declare v_emp uuid; v_real uuid; v_dup uuid;
begin
  select id into v_emp from public.empresas where nombre = 'BACANAL';
  if v_emp is null then return; end if;

  select id into v_real from public.productos
   where empresa_id = v_emp and tipo = 'venta' and nombre = 'Servicio Pan';
  select id into v_dup  from public.productos
   where empresa_id = v_emp and tipo = 'venta' and nombre = 'Servicio de pan';
  if v_real is null then return; end if;

  update public.productos
     set alergenos = ARRAY['Gluten']::text[], alergenos_modo = 'manual', visible_carta = true
   where id = v_real;

  update public.productos
     set alergenos = ARRAY['Sin alérgenos']::text[], alergenos_modo = 'manual'
   where empresa_id = v_emp and tipo = 'venta' and nombre = 'Servicio Pan Sin Gluten'
     and coalesce(cardinality(alergenos), 0) = 0;

  if v_dup is null then return; end if;

  update public.carta_items set producto_id = v_real
   where producto_id = v_dup
     and not exists (select 1 from public.carta_items o
                      where o.empresa_id = carta_items.empresa_id and o.producto_id = v_real);
  delete from public.carta_items where producto_id = v_dup;
  delete from public.productos   where id = v_dup;
end $$;
