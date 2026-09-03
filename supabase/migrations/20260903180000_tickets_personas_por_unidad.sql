-- Paquetes de varias personas en un producto de tipo Ticket.
--
-- POR QUÉ:
-- La "Cena Experiencia HABANA × BACANAL" se vende SIEMPRE de 2 en 2 (así lo
-- dicen la web y sus preguntas frecuentes). Con el selector por personas, el
-- cliente podía comprar 1 sola y presentarse solo a una experiencia diseñada
-- para dos.
--
-- En vez de vigilar un mínimo, la unidad de venta pasa a ser el PAQUETE: se
-- compran paquetes, y cada paquete trae `personas_por_unidad` comensales. Así
-- nunca sale un número impar.
--
-- Por defecto 1 = el producto se vende por persona, que es como se comportaban
-- todos los productos hasta ahora: nada existente cambia.
alter table reserva_ticket_productos
  add column if not exists personas_por_unidad smallint not null default 1;

alter table reserva_ticket_productos
  drop constraint if exists reserva_ticket_productos_personas_por_unidad_chk;

alter table reserva_ticket_productos
  add constraint reserva_ticket_productos_personas_por_unidad_chk
  check (personas_por_unidad between 1 and 50);

comment on column reserva_ticket_productos.personas_por_unidad is
  'Comensales que cubre cada unidad vendida. 1 = venta por persona (lo normal). '
  '2 = paquete para dos, como la Cena Experiencia HABANA x BACANAL.';

-- La experiencia se vende por paquetes de 2.
update reserva_ticket_productos
set personas_por_unidad = 2
where id = '49bd7451-346f-4175-8e6b-3407031a08b0';
