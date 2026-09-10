-- ============================================================================
-- "Patata frita" y "Patatas fritas" eran la misma guarnición dada de alta dos veces,
-- y por eso el mismo alérgeno había que marcarlo en dos sitios.
--
-- Se queda "Patatas fritas" (la que está en la categoría Guarnicion) y se reapunta
-- a ella los 3 platos que usaban la otra: entraña con guarnición, Burger Bacanal 2.0
-- y huevos rotos con jamón. La duplicada no tiene stock, ni movimientos, ni receta
-- propia, ni escandallo, ni ficha de carta, así que se borra en vez de dejarla
-- inactiva ensuciando el catálogo.
--
-- Idempotente: si ya se aplicó, no encuentra la duplicada y no hace nada.
-- ============================================================================
do $$
declare
  v_empresa uuid;
  v_dup     uuid;
  v_ok      uuid;
begin
  select id into v_empresa from public.empresas where nombre = 'BACANAL';
  if v_empresa is null then return; end if;

  select id into v_dup from public.productos
    where empresa_id = v_empresa and tipo = 'elaboracion' and nombre = 'Patata frita';
  select id into v_ok  from public.productos
    where empresa_id = v_empresa and tipo = 'elaboracion' and nombre = 'Patatas fritas';

  if v_dup is null or v_ok is null then return; end if;

  update public.producto_composicion pc
     set ingrediente_id = v_ok
   where pc.ingrediente_id = v_dup
     and not exists (
       select 1 from public.producto_composicion o
        where o.producto_venta_id = pc.producto_venta_id
          and o.ingrediente_id = v_ok
     );

  delete from public.producto_composicion where ingrediente_id = v_dup;
  delete from public.productos where id = v_dup;
end $$;
