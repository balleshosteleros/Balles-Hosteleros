-- Fusión de 7 fichas de producto duplicadas por la migración de junio.
--
-- EL PATRÓN (verificado contra producción el 2026-09-04): en cada pareja, la ficha
-- INACTIVA se quedó el `agora_id` y la ACTIVA se quedó los datos reales (precios,
-- stock, movimientos, alias). Resultado: Ágora apunta a una ficha vacía mientras las
-- existencias viven en la otra. Es la misma fusión a medias que el equipo de Iván
-- encontró en "Cebolla Roja" el 14-ago.
--
-- POR QUÉ IMPORTA AHORA: en Zanahoria y Lechuga romana la línea de escandallo apunta
-- a la ficha INACTIVA mientras `producto_composicion` (lo que descuenta stock) apunta
-- a la ACTIVA. Con el descuento encendido, la receta y el descuento mirarían fichas
-- distintas y el almacén no cuadraría nunca. No lo arregla que Ágora desaparezca:
-- es un duplicado interno.
--
-- Además, en esas dos el precio de proveedor PREFERIDO (el que manda en el coste)
-- estaba en la ficha muerta, así que su coste se venía calculando mal.
--
-- ORDEN: repuntar referencias → mover `agora_id` (primero se libera en la inactiva,
-- porque el índice único (empresa_id, agora_id, tipo) no admite las dos a la vez)
-- → borrar la inactiva. Todo en una transacción.
--
-- Comprobado antes de escribir esto: las 7 fichas inactivas NO tienen ninguna otra
-- referencia (0 en las 20 tablas con FK a productos), salvo las 2 que se repuntan aquí.

begin;

create temp table _fusion(inactiva uuid, activa uuid, etiqueta text) on commit drop;
insert into _fusion values
  ('7e255c5d-0720-4bbf-a5cc-006707cc969e','c81f422e-4a58-48a3-9b7a-d53383a25c03','Leche condensada (BACANAL)'),
  ('679d2a94-6716-41bd-a56a-17e1c15aafdd','d73e92de-bd56-4e1a-ab39-97d3c836813b','Lechuga romana (BACANAL)'),
  ('269435c3-fbf4-4878-b7f4-3758d9cc8a62','ac890438-2aa7-4fd1-9840-d3ec14ec7e58','Patata lavada (BACANAL)'),
  ('d1b12fa4-bf88-4a10-8ee5-6bdc64b41afa','bdfe4c0a-0610-47bc-9369-564630da5e5d','Yema de huevo (BACANAL)'),
  ('5573766a-f42c-4963-a785-f1f05731ec1f','a64a0f8d-9017-4d5e-8573-404d670b12f8','Zanahoria (BACANAL)'),
  ('dd4bfdf1-8659-4997-a46a-8491fd407dcc','5ab6a841-64ca-44ed-8b37-cb8f8770658a','Clear Little Mix (HABANA)'),
  ('db787861-1007-4dfa-af5f-2c792dda80e0','9c361858-ef01-41f8-b031-b006ece31a5b','Mix Goma Pica (HABANA)');

-- 1) Repuntar a la ficha buena lo que colgaba de la muerta.
--    Solo aplica a Zanahoria y Lechuga romana; en las otras 5 es no-op.
update escandallo_ingredientes ei set producto_id = f.activa
  from _fusion f where ei.producto_id = f.inactiva;

update ingredientes_proveedor ip set producto_id = f.activa
  from _fusion f where ip.producto_id = f.inactiva;

-- 2) Mover el agora_id. Se libera primero en la inactiva para no chocar con el
--    índice único parcial (empresa_id, agora_id, tipo).
--    Solo se copia si la ficha buena no tiene ya uno (Mix Goma Pica ya lo tiene).
create temp table _agora(activa uuid, agora_id text) on commit drop;
insert into _agora
  select f.activa, pi.agora_id
    from _fusion f
    join productos pi on pi.id = f.inactiva
    join productos pa on pa.id = f.activa
   where pi.agora_id is not null and pa.agora_id is null;

update productos p set agora_id = null
  from _fusion f where p.id = f.inactiva;

update productos p set agora_id = a.agora_id
  from _agora a where p.id = a.activa;

-- 3) Retirar las fichas duplicadas, ya sin referencias.
delete from productos p using _fusion f where p.id = f.inactiva;

commit;
