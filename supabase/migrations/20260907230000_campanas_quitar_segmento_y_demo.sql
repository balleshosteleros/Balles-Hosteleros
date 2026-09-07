-- ============================================================
-- Limpieza de `campanas_marketing`: fuera el segmento de texto y el modo demo.
--
-- ── `segmento` (texto) ─────────────────────────────────────────────────────
-- Era la forma antigua de decir a quién iba la campaña: una lista cerrada de
-- cinco nombres (todos, vip, recurrentes, inactivos, nuevos). La sustituyó
-- `segmento_json`, que permite condiciones de verdad ("sin venir desde hace 90
-- días y con más de 5 visitas"). Desde entonces la columna guardaba siempre
-- "todos" y NADIE la leía para decidir el envío.
--
-- No se quita por estética: se quita porque miente. Un campo que pone "vip" en
-- una campaña que en realidad sale a los nueve mil clientes es un error
-- esperando a que alguien se fíe de él.
--
-- ── `demo_mode` ────────────────────────────────────────────────────────────
-- Existía cuando las campañas no podían enviarse de verdad: el botón "demo"
-- escribía filas en `campanas_envios` como si se hubiera enviado, sin llamar a
-- nadie. Ahora el envío es real, y esos apuntes falsos contaban como enviados en
-- las estadísticas de la campaña, inflando el número que hay que mirar para
-- decidir si el correo funcionó.
--
-- Idempotente.
-- ============================================================

-- La vista del listado de campañas arrastraba `demo_mode`, así que hay que
-- retirarla ANTES de tocar la columna. Se rehace igual, sin ella: el resto
-- (envíos, aperturas y reservas atribuidas al enlace) no cambia.
drop view if exists public.v_campanas_atribucion;

alter table public.campanas_marketing
  drop column if exists segmento,
  drop column if exists demo_mode;

create view public.v_campanas_atribucion as
select
  c.id                as campana_id,
  c.empresa_id,
  c.nombre,
  c.canal,
  c.estado,
  c.ultima_ejecucion,
  rl.palabra_clave    as origen,
  ((select count(*) from campanas_envios e
     where e.campana_id = c.id and e.estado = any (array['enviado','abierto'])))::integer as enviados,
  ((select count(*) from campanas_envios e
     where e.campana_id = c.id and e.estado = 'abierto'))::integer as abiertos,
  ((select count(*) from reservas r
     where r.empresa_id = c.empresa_id
       and rl.palabra_clave is not null
       and r.origen = rl.palabra_clave))::integer as reservas_generadas
from campanas_marketing c
left join reserva_links rl on rl.id = c.reserva_link_id;
