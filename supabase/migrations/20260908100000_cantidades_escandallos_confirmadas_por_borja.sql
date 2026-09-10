-- ============================================================================
-- Cantidades de escandallo confirmadas por el jefe de cocina (Borja, 08-09-2026).
--
-- En el Excel de fichas técnicas estas cantidades no se leían: se había copiado
-- por error el nombre de otro plato encima de la celda. Borja las ha dado por
-- correo y CORRIGEN al Excel donde difieren (sepia 150→120, rape 100→120).
--
-- Unidad: gramos, que es la convención de `producto_composicion.cantidad` en todo
-- el sistema (ver el aviso de ventas-dia-promedio.ts: las recetas guardan gramos
-- y `factor_conversion` sigue a 1 en los 693 productos). La vieira va en unidades
-- porque así está en la ficha; queda dentro del mismo agujero de conversión ya
-- documentado, no lo abre esta migración.
--
-- 1) Arroz de señoret: las 5 cantidades estaban a 0.
-- 2) Curry rojo: la salsa estaba a 0 (en la ficha ponía "cs", cantidad suficiente).
-- 3) Torrija: el escandallo estaba VACÍO. Se monta con el cambio que pidió Borja:
--    fuera la "Salsa Infusionada", dentro 15 g de sirope de caramelo, y el helado
--    de vainilla a 50 g. El pan brioche a 60 g sale de la ficha.
--
-- PENDIENTE (no lo hace esta migración): "Tortilla trufada huevo" sigue con el
-- escandallo vacío porque 3 de sus 4 ingredientes no existen en el catálogo —
-- "Patata pochada", "Huevo a baja temperatura" y "Espuma de yema". Hay que darlos
-- de alta como elaboraciones antes de poder montarla.
--
-- Idempotente: empareja por nombre exacto dentro de BACANAL; los insert llevan
-- "on conflict do nothing" y los update reescriben el mismo valor si se repite.
-- ============================================================================
do $$
declare
  v_empresa uuid;
  v_plato   uuid;
  v_ing     uuid;
begin
  select id into v_empresa from public.empresas where nombre = 'BACANAL';
  if v_empresa is null then return; end if;

  -- ── 1) Arroz de señoret ──────────────────────────────────────────────
  select id into v_plato from public.productos
    where empresa_id = v_empresa and tipo = 'venta' and nombre = 'Arroz de señoret';

  if v_plato is not null then
    update public.producto_composicion pc set cantidad = v.cant
      from (values
        ('Base de arroz de pescado', 400::numeric),
        ('Sepia',                    120),
        ('Cola de rape 80/150',      120),
        ('Gamba cola pelada 50/70',   80),
        ('Vieira media',               2)
      ) as v(nombre, cant)
      join public.productos i
        on i.empresa_id = v_empresa and i.nombre = v.nombre
     where pc.producto_venta_id = v_plato
       and pc.ingrediente_id = i.id;
  end if;

  -- ── 2) Curry rojo con verduras ───────────────────────────────────────
  select id into v_plato from public.productos
    where empresa_id = v_empresa and tipo = 'venta' and nombre = 'Curry Rojo con Verduras';
  select id into v_ing from public.productos
    where empresa_id = v_empresa and nombre = 'Salsa de curry rojo';

  if v_plato is not null and v_ing is not null then
    update public.producto_composicion
       set cantidad = 200
     where producto_venta_id = v_plato
       and ingrediente_id = v_ing;
  end if;

  -- ── 3) Torrija con helado de vainilla (escandallo nuevo) ─────────────
  select id into v_plato from public.productos
    where empresa_id = v_empresa and tipo = 'venta' and nombre = 'Torrijas con helado de vainilla';

  if v_plato is not null then
    insert into public.producto_composicion (producto_venta_id, ingrediente_id, cantidad)
    select v_plato, i.id, v.cant
      from (values
        ('Pan briocht',        60::numeric),
        ('Sirope Caramelo',    15),
        ('Helado de vainilla', 50)
      ) as v(nombre, cant)
      join public.productos i
        on i.empresa_id = v_empresa and i.nombre = v.nombre
    on conflict do nothing;
  end if;
end $$;
