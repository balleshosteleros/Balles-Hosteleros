-- Qué campaña trajo cada mesa.
--
-- Con un solo enlace de correo (EMAIL) la columna "reservas generadas" de la
-- pantalla de campañas contaba las reservas cuyo origen coincidía con la
-- palabra clave del enlace: al compartirlo, las quince campañas de cada local
-- mostraban EL MISMO número, y encima sin ventana de tiempo (el histórico
-- entero). Ahora cada correo lleva su campaña en el enlace (`?c=enero`) y la
-- reserva guarda de cuál vino.
--
-- El canal se sigue leyendo en `reservas.origen` (EMAIL): esto no lo sustituye,
-- lo detalla.

-- Palabra de la campaña: la que viaja en el enlace. Minúsculas y sin rarezas,
-- porque se lee en la URL de un correo.
alter table campanas_marketing add column if not exists palabra text;

create unique index if not exists campanas_marketing_empresa_palabra_key
  on campanas_marketing (empresa_id, palabra)
  where palabra is not null;

alter table campanas_marketing drop constraint if exists chk_campanas_palabra;
alter table campanas_marketing add constraint chk_campanas_palabra
  check (palabra is null or palabra ~ '^[a-z0-9]{1,24}$');

-- La reserva recuerda su campaña. `set null` al borrarla: la mesa es real y no
-- desaparece porque se borre una campaña.
alter table reservas add column if not exists campana_id uuid
  references campanas_marketing (id) on delete set null;

create index if not exists idx_reservas_campana
  on reservas (campana_id)
  where campana_id is not null;

-- Palabra de las campañas ya sembradas. Las doce del calendario van por su mes,
-- que es 1:1 con la campaña. La felicitación del cumpleaños no lleva enlace de
-- reserva, y las de SMS y WhatsApp aún no envían: sin palabra hasta entonces.
update campanas_marketing
set palabra = 'cumpleanos'
where palabra is null
  and canal = 'email'
  and payload->>'claveSeed' = 'CUMPLEANOS';

update campanas_marketing
set palabra = lower(split_part(payload->>'claveSeed', '_', 1))
where palabra is null
  and canal = 'email'
  and lower(split_part(payload->>'claveSeed', '_', 1)) in (
    'enero','febrero','marzo','abril','mayo','junio',
    'julio','agosto','septiembre','octubre','noviembre','diciembre'
  );

-- La atribución pasa a contarse por campaña. `origen` se mantiene en la vista
-- porque la pantalla lo muestra como canal.
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
  -- Al final a propósito: `create or replace view` no permite reordenar ni
  -- renombrar columnas, así que lo nuevo se añade por detrás.
  c.palabra
from campanas_marketing c
left join reserva_links rl on rl.id = c.reserva_link_id;
