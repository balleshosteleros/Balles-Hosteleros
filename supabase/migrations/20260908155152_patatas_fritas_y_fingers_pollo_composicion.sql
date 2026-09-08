-- ============================================================================
-- "Patatas fritas" y "Fingers de pollo" (elaboraciones) no tenían composición
-- propia: no derivaban coste ni descontaban stock de ningún producto de compra.
-- Confirmado con Iván qué llevan (09-09-2026):
--   · Patatas fritas  → Patata Agria (la variedad de fritura, no "Patata lavada"
--     que se usa para hervir/ensaladilla). 150 g, la cantidad que ya usan la
--     mayoría de platos que llevan esta guarnición.
--   · Fingers de pollo → el producto de compra "Fingers de pollo" (viene ya
--     preparado del proveedor). 120 g, la cantidad real que usa el único plato
--     que los lleva ("Fingers de pollo con patatas").
--
-- Mismo criterio que "Corvina frita"/"Pimientos fritos" (20260908170000):
-- elaboración = versión cocinada/frita del producto de compra, 1:1 sin merma.
--
-- Idempotente: on conflict do nothing.
-- ============================================================================
do $$
declare
  v_empresa        uuid;
  v_patatas_frit   uuid;
  v_patata_agria   uuid;
  v_fingers_elab   uuid;
  v_fingers_compra uuid;
begin
  select id into v_empresa from public.empresas where nombre = 'BACANAL';
  if v_empresa is null then return; end if;

  select id into v_patatas_frit from public.productos
    where empresa_id = v_empresa and tipo = 'elaboracion' and nombre = 'Patatas fritas';
  select id into v_patata_agria from public.productos
    where empresa_id = v_empresa and tipo = 'compra' and nombre = 'Patata Agria';

  if v_patatas_frit is not null and v_patata_agria is not null then
    insert into public.producto_composicion (producto_venta_id, ingrediente_id, cantidad)
    values (v_patatas_frit, v_patata_agria, 150)
    on conflict do nothing;
  end if;

  select id into v_fingers_elab from public.productos
    where empresa_id = v_empresa and tipo = 'elaboracion' and nombre = 'Fingers de pollo';
  select id into v_fingers_compra from public.productos
    where empresa_id = v_empresa and tipo = 'compra' and nombre = 'Fingers de pollo';

  if v_fingers_elab is not null and v_fingers_compra is not null then
    insert into public.producto_composicion (producto_venta_id, ingrediente_id, cantidad)
    values (v_fingers_elab, v_fingers_compra, 120)
    on conflict do nothing;
  end if;
end $$;
