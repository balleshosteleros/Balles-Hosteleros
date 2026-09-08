-- ============================================================================
-- Tortilla trufada huevo: quedaba con el escandallo vacío porque 3 de sus 4
-- ingredientes no existían en el catálogo (ver 20260908100000). Se crean como
-- elaboraciones simples (sin composición propia, mismo criterio que "Patatas
-- fritas") y se monta el escandallo completo con las cantidades que dio Borja:
--   · Patata pochada          150 g (ya estaba en la ficha original)
--   · Salsa tartufata          15 g (ya existía en el catálogo como compra)
--   · Huevo a baja temperatura   1 ud
--   · Espuma de yema           60 g
--
-- Idempotente: no crea la elaboración si ya existe, y el escandallo se monta
-- con on conflict do nothing por si ya se aplicó.
-- ============================================================================
do $$
declare
  v_empresa   uuid;
  v_plato     uuid;
  v_seq       int;
  v_patata    uuid;
  v_huevo     uuid;
  v_espuma    uuid;
  v_tartufata uuid;
begin
  select id into v_empresa from public.empresas where nombre = 'BACANAL';
  if v_empresa is null then return; end if;

  select id into v_plato from public.productos
    where empresa_id = v_empresa and tipo = 'venta' and nombre = 'Tortilla trufada huevo';
  if v_plato is null then return; end if;

  -- ── Crear las 3 elaboraciones que faltan ─────────────────────────────
  select id into v_patata from public.productos
    where empresa_id = v_empresa and tipo = 'elaboracion' and nombre = 'Patata pochada';
  if v_patata is null then
    select coalesce(max(numero_secuencial),0)+1 into v_seq
      from public.productos where empresa_id = v_empresa and tipo = 'elaboracion';
    insert into public.productos (empresa_id, tipo, nombre, categoria, medida, numero_secuencial)
    values (v_empresa, 'elaboracion', 'Patata pochada', 'Guarnicion', 'Unidades', v_seq)
    returning id into v_patata;
  end if;

  select id into v_huevo from public.productos
    where empresa_id = v_empresa and tipo = 'elaboracion' and nombre = 'Huevo a baja temperatura';
  if v_huevo is null then
    select coalesce(max(numero_secuencial),0)+1 into v_seq
      from public.productos where empresa_id = v_empresa and tipo = 'elaboracion';
    insert into public.productos (empresa_id, tipo, nombre, categoria, medida, numero_secuencial)
    values (v_empresa, 'elaboracion', 'Huevo a baja temperatura', 'Sin categoría', 'Unidades', v_seq)
    returning id into v_huevo;
  end if;

  select id into v_espuma from public.productos
    where empresa_id = v_empresa and tipo = 'elaboracion' and nombre = 'Espuma de yema';
  if v_espuma is null then
    select coalesce(max(numero_secuencial),0)+1 into v_seq
      from public.productos where empresa_id = v_empresa and tipo = 'elaboracion';
    insert into public.productos (empresa_id, tipo, nombre, categoria, medida, numero_secuencial)
    values (v_empresa, 'elaboracion', 'Espuma de yema', 'Sin categoría', 'Unidades', v_seq)
    returning id into v_espuma;
  end if;

  select id into v_tartufata from public.productos
    where empresa_id = v_empresa and tipo = 'compra' and nombre = 'Salsa tartufata';

  -- ── Montar el escandallo completo ────────────────────────────────────
  insert into public.producto_composicion (producto_venta_id, ingrediente_id, cantidad)
  select v_plato, x.i, x.c from (values
      (v_patata, 150::numeric),
      (v_huevo,    1),
      (v_espuma,  60)
    ) as x(i, c)
  where x.i is not null
  on conflict do nothing;

  if v_tartufata is not null then
    insert into public.producto_composicion (producto_venta_id, ingrediente_id, cantidad)
    values (v_plato, v_tartufata, 15)
    on conflict do nothing;
  end if;
end $$;
