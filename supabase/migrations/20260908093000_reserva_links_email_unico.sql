-- Un solo enlace de reserva para el correo: EMAIL.
--
-- Las campañas del calendario creaban un enlace por mes (EMAIL_ENERO,
-- EMAIL_FEBRERO…) y la pantalla de enlaces de Sala amanecía con doce filas por
-- local. Como la palabra clave se graba en `reservas.origen`, además partía el
-- canal del correo en doce columnas de analítica, cuando en Sala solo interesa
-- saber cuántas mesas llegaron POR CORREO. Qué campaña concreta las trajo se
-- mide en Marketing, con sus envíos y sus clics.
--
-- Idempotente: cuando ya no queda ningún EMAIL_%, no hace nada.

-- 1) El enlace único, uno por empresa que tuviera enlaces por mes. La URL se
--    saca de la que ya existía cambiando el último tramo: así respeta el
--    dominio propio del restaurante si lo tiene.
insert into reserva_links (empresa_id, palabra_clave, url_generada, nombre, activo, vende_tickets)
select distinct on (rl.empresa_id)
       rl.empresa_id,
       'EMAIL',
       regexp_replace(rl.url_generada, '/[^/]+$', '/email'),
       'Email',
       true,
       false
from reserva_links rl
where rl.palabra_clave like 'EMAIL\_%'
order by rl.empresa_id, rl.palabra_clave
on conflict (empresa_id, palabra_clave) do nothing;

-- 2) Las campañas que apuntaban al enlace de su mes pasan al enlace único. Sin
--    esto la FK las dejaría en NULL y el correo saldría sin atribución.
update campanas_marketing c
set reserva_link_id = nuevo.id
from reserva_links viejo
join reserva_links nuevo
  on nuevo.empresa_id = viejo.empresa_id
 and nuevo.palabra_clave = 'EMAIL'
where c.reserva_link_id = viejo.id
  and viejo.palabra_clave like 'EMAIL\_%';

-- 3) Reservas y clientes que ya hubieran entrado por un enlace mensual: su
--    canal pasa a ser EMAIL, que es el que tiene etiqueta y color.
update reservas set origen = 'EMAIL' where origen like 'EMAIL\_%';
update clientes_sala set origen = 'EMAIL' where origen like 'EMAIL\_%';

-- 4) Fuera los doce.
delete from reserva_links where palabra_clave like 'EMAIL\_%';

-- 5) El de cumpleaños se queda —es un correo uno a uno, no una campaña del
--    calendario— pero con nombre de persona, no con el "Campaña de email ·
--    cumpleanos" que salía de construir el texto a partir de la palabra clave.
update reserva_links
set nombre = 'Cumpleaños'
where palabra_clave = 'CUMPLEANOS'
  and (nombre is null or nombre <> 'Cumpleaños');
