-- ============================================================================
-- Dos escandallos con la receta equivocada, detectados al cruzar con las fichas
-- técnicas. No es un problema de alérgenos: la composición no era la del plato,
-- y por eso derivaba alérgenos falsos (o de menos).
--
-- 1) "Jamon Iberico con Pan Cristal": su composición llevaba croquetas de jamón
--    con panko (80 g) y pan brioche (50 g). Según la ficha, el plato es jamón
--    (80 g) + pan (50 g) + tomate rallado. Se sustituyen los dos ingredientes
--    equivocados por los reales; el tomate pera ya estaba y se conserva.
--
-- 2) "Cachopo con Jamon y Queso curado": va empanado con panko y huevo, y ni uno
--    ni otro estaban en la composición, así que solo derivaba Lácteos. Se añaden.
--    La ficha declara Gluten, Huevos y Lácteos: ahora la cascada coincide.
--
-- Idempotente: los delete no fallan si ya se aplicó, y los insert usan
-- "on conflict do nothing".
-- ============================================================================
do $$
declare
  v_jamon_plato   uuid;
  v_cachopo_plato uuid;
  v_empresa       uuid;
  v_paleta        uuid;
  v_pan           uuid;
  v_panko         uuid;
  v_huevo         uuid;
  v_croquetas     uuid;
  v_brioche       uuid;
begin
  select id into v_empresa from public.empresas where nombre = 'BACANAL';
  if v_empresa is null then return; end if;

  select id into v_jamon_plato   from public.productos
    where empresa_id = v_empresa and tipo = 'venta' and nombre = 'Jamon Iberico con Pan Cristal';
  select id into v_cachopo_plato from public.productos
    where empresa_id = v_empresa and tipo = 'venta' and nombre = 'Cachopo con Jamon y Queso curado';

  select id into v_paleta    from public.productos where empresa_id = v_empresa and tipo='compra' and nombre = 'Paleta cebo ibérico 50% loncheada';
  select id into v_pan       from public.productos where empresa_id = v_empresa and tipo='compra' and nombre = 'Pan Diamante Blanco';
  select id into v_panko     from public.productos where empresa_id = v_empresa and tipo='compra' and nombre = 'Panko';
  select id into v_huevo     from public.productos where empresa_id = v_empresa and tipo='compra' and nombre = 'Huevo';
  select id into v_croquetas from public.productos where empresa_id = v_empresa and tipo='compra' and nombre = 'Croquetas de jamon con panko';
  select id into v_brioche   from public.productos where empresa_id = v_empresa and tipo='compra' and nombre = 'Pan briocht';

  if v_jamon_plato is not null then
    delete from public.producto_composicion
      where producto_venta_id = v_jamon_plato
        and ingrediente_id in (v_croquetas, v_brioche);

    if v_paleta is not null then
      insert into public.producto_composicion (producto_venta_id, ingrediente_id, cantidad)
      values (v_jamon_plato, v_paleta, 80) on conflict do nothing;
    end if;
    if v_pan is not null then
      insert into public.producto_composicion (producto_venta_id, ingrediente_id, cantidad)
      values (v_jamon_plato, v_pan, 50) on conflict do nothing;
    end if;
  end if;

  if v_cachopo_plato is not null then
    if v_panko is not null then
      insert into public.producto_composicion (producto_venta_id, ingrediente_id, cantidad)
      values (v_cachopo_plato, v_panko, 40) on conflict do nothing;
    end if;
    if v_huevo is not null then
      insert into public.producto_composicion (producto_venta_id, ingrediente_id, cantidad)
      values (v_cachopo_plato, v_huevo, 1) on conflict do nothing;
    end if;
  end if;
end $$;
