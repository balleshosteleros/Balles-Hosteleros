-- ============================================================================
-- El gluten de la guarnición no está en la patata ni en el pimiento: está en el
-- aceite de la freidora, que se comparte con producto empanado (panko, croquetas,
-- cachopo). Por eso lo frito tiene que ser una ELABORACIÓN propia y no el producto
-- crudo: así el pimiento crudo de una ensalada sigue sin declarar gluten, y solo
-- lo declara el que pasa por la freidora.
--
-- "Patatas fritas" ya existía con ese criterio. Se crean las dos que faltaban:
--   · Pimientos fritos  → guarnición del tomahawk y del lomo bajo
--   · Corvina frita     → el pescado del curry rojo, que va frito
--     (la corvina del ceviche NO se toca: ahí va cruda y sigue sin gluten)
--
-- Ambas heredan categoría, medida y partida de "Patatas fritas" para no inventar
-- criterios nuevos, y llevan su propia composición para que el coste y el stock
-- sigan saliendo del producto crudo.
--
-- Idempotente: no crea la elaboración si ya existe, y los swaps solo actúan si
-- el ingrediente crudo sigue en la receta.
-- ============================================================================
do $$
declare
  v_empresa   uuid;
  v_patatas   uuid;
  v_pim_frito uuid;
  v_corv_frit uuid;
  v_pimiento  uuid;
  v_corvina   uuid;
  v_tomahawk  uuid;
  v_curry     uuid;
  v_cat       text;
  v_medida    text;
  v_partida   text;
  v_seq       int;
begin
  select id into v_empresa from public.empresas where nombre = 'BACANAL';
  if v_empresa is null then return; end if;

  select id, categoria, medida, partida
    into v_patatas, v_cat, v_medida, v_partida
    from public.productos
   where empresa_id = v_empresa and tipo = 'elaboracion' and nombre = 'Patatas fritas';
  if v_patatas is null then return; end if;

  select id into v_pimiento from public.productos
    where empresa_id = v_empresa and tipo = 'compra' and nombre = 'Pimiento Rojo';
  select id into v_corvina  from public.productos
    where empresa_id = v_empresa and tipo = 'compra' and nombre = 'Corvina';

  -- ── Pimientos fritos ────────────────────────────────────────────────
  select id into v_pim_frito from public.productos
    where empresa_id = v_empresa and tipo = 'elaboracion' and nombre = 'Pimientos fritos';

  if v_pim_frito is null then
    select coalesce(max(numero_secuencial), 0) + 1 into v_seq
      from public.productos where empresa_id = v_empresa and tipo = 'elaboracion';

    insert into public.productos
      (empresa_id, tipo, nombre, categoria, medida, partida, numero_secuencial,
       alergenos, alergenos_modo)
    values
      (v_empresa, 'elaboracion', 'Pimientos fritos', v_cat, v_medida, v_partida, v_seq,
       ARRAY['Gluten']::text[], 'manual')
    returning id into v_pim_frito;

    if v_pimiento is not null then
      insert into public.producto_composicion (producto_venta_id, ingrediente_id, cantidad)
      values (v_pim_frito, v_pimiento, 100) on conflict do nothing;
    end if;
  end if;

  -- ── Corvina frita ───────────────────────────────────────────────────
  select id into v_corv_frit from public.productos
    where empresa_id = v_empresa and tipo = 'elaboracion' and nombre = 'Corvina frita';

  if v_corv_frit is null then
    select coalesce(max(numero_secuencial), 0) + 1 into v_seq
      from public.productos where empresa_id = v_empresa and tipo = 'elaboracion';

    insert into public.productos
      (empresa_id, tipo, nombre, categoria, medida, partida, numero_secuencial,
       alergenos, alergenos_modo)
    values
      (v_empresa, 'elaboracion', 'Corvina frita', v_cat, v_medida, v_partida, v_seq,
       ARRAY['Gluten']::text[], 'manual')
    returning id into v_corv_frit;

    if v_corvina is not null then
      insert into public.producto_composicion (producto_venta_id, ingrediente_id, cantidad)
      values (v_corv_frit, v_corvina, 130) on conflict do nothing;
    end if;
  end if;

  -- ── Meterlas en las recetas, conservando la cantidad que ya tenían ──
  select id into v_tomahawk from public.productos
    where empresa_id = v_empresa and tipo = 'venta' and nombre = 'Tomahawk';
  select id into v_curry    from public.productos
    where empresa_id = v_empresa and tipo = 'venta' and nombre = 'Curry Rojo con Verduras';

  if v_tomahawk is not null and v_pimiento is not null then
    update public.producto_composicion
       set ingrediente_id = v_pim_frito
     where producto_venta_id = v_tomahawk and ingrediente_id = v_pimiento;
  end if;

  if v_curry is not null and v_corvina is not null then
    update public.producto_composicion
       set ingrediente_id = v_corv_frit
     where producto_venta_id = v_curry and ingrediente_id = v_corvina;
  end if;
end $$;
