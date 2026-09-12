-- Cuántas PERSONAS ha traído cada campaña, no solo cuántas reservas.
--
-- Una mesa de diez por el cumpleaños y una de dos por el correo de enero no
-- valen lo mismo, y contando reservas las dos suman uno. Los comensales son lo
-- que de verdad dice si la campaña llena el local.
--
-- `personas_generadas` va al final: `create or replace view` no deja reordenar
-- ni renombrar columnas.
create or replace view v_campanas_atribucion as
select
  c.id as campana_id,
  c.empresa_id,
  c.nombre,
  c.canal,
  c.estado,
  c.ultima_ejecucion,
  rl.palabra_clave as origen,
  (
    select count(*)
    from campanas_envios e
    where e.campana_id = c.id and e.estado in ('enviado', 'abierto')
  )::integer as enviados,
  (
    select count(*)
    from campanas_envios e
    where e.campana_id = c.id and e.estado = 'abierto'
  )::integer as abiertos,
  (
    select count(*)
    from reservas r
    where r.campana_id = c.id
  )::integer as reservas_generadas,
  c.palabra,
  (
    select coalesce(sum(r.personas), 0)
    from reservas r
    where r.campana_id = c.id
  )::integer as personas_generadas
from campanas_marketing c
left join reserva_links rl on rl.id = c.reserva_link_id;
