-- ============================================================
-- 20260912180000_saldo_inicial_uniforme_habana_bacanal.sql
-- El uniforme que ya existía entra en el almacén como saldo de partida.
--
-- Las 32 piezas que lleva puesta la gente de HABANA y BACANAL se cargaron como
-- entregas con su acta. Pero una entrega MUEVE una pieza del almacén a las manos
-- del trabajador; no la crea. Sin esto, al firmar cada acta el almacén bajaría a
-- −1 y el total de la empresa quedaría en 0, cuando la empresa tiene 32 piezas
-- de verdad.
--
-- Así que cada pieza entra primero en la estantería como `inicial` (+1 almacén).
-- El resultado es el correcto en los dos escenarios:
--   · Antes de firmar:  32 en almacén,  0 en manos,  total 32.
--   · Después de firmar: 0 en almacén, 32 en manos,  total 32.
--
-- POR QUÉ `inicial` Y NO `compra`
--   No se han comprado hoy: ya estaban. `compra` lleva proveedor, albarán y
--   coste, y no hay nada de eso — son piezas de las que solo se sabe que
--   existen. `inicial` es exactamente eso: el punto de partida del almacén.
--
-- Idempotente: solo crea el `inicial` de las piezas que aún no lo tienen, así
-- que aplicarla dos veces no infla el almacén.
-- ============================================================

insert into public.material_movimientos (
  empresa_id, tipo_id, tipo_nombre, categoria, talla,
  fecha, tipo_movimiento, delta_almacen, delta_manos,
  entrega_id, empleado_id, motivo, created_por_nombre
)
select
  m.empresa_id,
  i.tipo_id,
  i.tipo_nombre,
  i.categoria,
  i.talla,
  m.fecha,
  'inicial',
  1,   -- entra en la estantería
  0,
  m.id,
  m.empleado_id,
  'Uniforme que ya tenía el trabajador al estrenar el almacén',
  m.entregado_por_nombre
from public.entregas_material m
join public.entregas_material_items i on i.entrega_id = m.id
where not exists (
  select 1 from public.material_movimientos x
  where x.entrega_id = m.id and x.tipo_movimiento = 'inicial'
);
