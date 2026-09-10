-- ============================================================================
-- La lubina se sustituyó por corvina (más barata). En el catálogo se veía claro:
-- la lubina no tenía precio de compra ni un solo movimiento de stock, mientras que
-- la corvina sí tiene precio (12,43 €) y movimiento real.
--
-- Se reapuntan las dos recetas que la usaban (Ceviche Thai y Curry rojo con
-- verduras) y se borra la lubina, que no deja histórico detrás.
--
-- Idempotente: si ya se aplicó, no encuentra la lubina y no hace nada.
-- ============================================================================
do $$
declare
  v_empresa uuid;
  v_lubina  uuid;
  v_corvina uuid;
begin
  select id into v_empresa from public.empresas where nombre = 'BACANAL';
  if v_empresa is null then return; end if;

  select id into v_lubina  from public.productos
    where empresa_id = v_empresa and tipo = 'compra' and nombre = 'Lubina';
  select id into v_corvina from public.productos
    where empresa_id = v_empresa and tipo = 'compra' and nombre = 'Corvina';

  if v_lubina is null or v_corvina is null then return; end if;

  update public.producto_composicion pc
     set ingrediente_id = v_corvina
   where pc.ingrediente_id = v_lubina
     and not exists (
       select 1 from public.producto_composicion o
        where o.producto_venta_id = pc.producto_venta_id
          and o.ingrediente_id = v_corvina
     );

  delete from public.producto_composicion where ingrediente_id = v_lubina;
  delete from public.productos where id = v_lubina;
end $$;
