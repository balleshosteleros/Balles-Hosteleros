-- Histórico de correos enviados de una reserva, con la persona que lo envió.
--
-- POR QUÉ: hasta ahora la única huella de un correo eran cuatro timestamps en
-- `reservas` (email_confirmacion_at, email_reconfirmacion_at,
-- email_recordatorio_at, email_cancelacion_at). Eso tiene dos límites:
--   (1) un reenvío manual machaca el timestamp anterior, así que solo se
--       conserva el ÚLTIMO envío de cada tipo y los previos se pierden;
--   (2) no consta QUIÉN lo mandó — el mailer corre con service role.
-- Cuando un cliente reclama ("nadie me avisó"), hay que poder decir qué salió,
-- cuándo y de la mano de quién.
--
-- Las cuatro columnas antiguas SE MANTIENEN: son las que dan la idempotencia
-- (el cron no reenvía si ya hay timestamp) y alimentan dos índices parciales.
-- Esta tabla es aditiva: registra, no sustituye.
--
-- Solo se registran los envíos que SALEN. Los correos que no se envían no se
-- anotan aquí — es decisión de producto, no un olvido.
--
-- Idempotente: IF NOT EXISTS en todo + backfill acotado.

create table if not exists public.reserva_email_envios (
  id            uuid primary key default gen_random_uuid(),
  reserva_id    uuid not null references public.reservas(id) on delete cascade,
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  tipo          text not null,
  destinatario  text,
  asunto        text,

  -- Autoría. `usuario_id` es la fila de `usuarios` (no auth.users) de la
  -- persona con sesión abierta que provocó el envío. Es NULL cuando no hay
  -- persona detrás: el cron nocturno, el formulario público y el booking
  -- server de Google no tienen sesión. Para esos casos manda `origen`.
  usuario_id    uuid references public.usuarios(id) on delete set null,
  -- Nombre congelado en el momento del envío: si la persona cambia de nombre
  -- o se da de baja, el histórico tiene que seguir diciendo quién fue.
  usuario_nombre text,
  origen        text not null default 'MANUAL',

  enviado_at    timestamptz not null default now()
);

comment on table public.reserva_email_envios is
  'Histórico de correos de reserva realmente enviados, con la persona que los envió. Solo envíos efectivos; los no enviados no se registran.';
comment on column public.reserva_email_envios.tipo is
  'CONFIRMACION | RECONFIRMACION | RECORDATORIO | CANCELACION.';
comment on column public.reserva_email_envios.usuario_id is
  'Usuario con sesión que provocó el envío. NULL en envíos sin persona detrás (cron, portal público, Google RwG) — ver `origen`.';
comment on column public.reserva_email_envios.usuario_nombre is
  'Nombre de la persona en el momento del envío. Se congela para que el histórico no cambie si luego se renombra o se da de baja.';
comment on column public.reserva_email_envios.origen is
  'MANUAL (persona en el software) | AUTOMATICO (cron) | PORTAL_PUBLICO (formulario web del cliente) | GOOGLE_RWG (Reserve with Google).';

alter table public.reserva_email_envios
  drop constraint if exists reserva_email_envios_tipo_chk;
alter table public.reserva_email_envios
  add constraint reserva_email_envios_tipo_chk
  check (tipo in ('CONFIRMACION','RECONFIRMACION','RECORDATORIO','CANCELACION'));

alter table public.reserva_email_envios
  drop constraint if exists reserva_email_envios_origen_chk;
alter table public.reserva_email_envios
  add constraint reserva_email_envios_origen_chk
  check (origen in ('MANUAL','AUTOMATICO','PORTAL_PUBLICO','GOOGLE_RWG'));

-- Acceso principal: el histórico de UNA reserva, del más reciente al más
-- antiguo, que es justo como lo pinta la ficha.
create index if not exists reserva_email_envios_reserva_idx
  on public.reserva_email_envios (reserva_id, enviado_at desc);

create index if not exists reserva_email_envios_empresa_idx
  on public.reserva_email_envios (empresa_id, enviado_at desc);

-- ---------------------------------------------------------------------------
-- RLS: multiempresa por el helper canónico del proyecto.
-- ---------------------------------------------------------------------------
alter table public.reserva_email_envios enable row level security;

drop policy if exists reserva_email_envios_select on public.reserva_email_envios;
create policy reserva_email_envios_select
  on public.reserva_email_envios for select
  using (empresa_id in (select public.empresas_del_usuario()));

-- Sin políticas de INSERT/UPDATE/DELETE a propósito: el histórico lo escribe
-- SIEMPRE el mailer con service role (que salta RLS), y nadie debe poder
-- reescribirlo desde el cliente. Un histórico editable no prueba nada.

-- ---------------------------------------------------------------------------
-- Backfill: los envíos que ya constan en las columnas antiguas pasan al
-- histórico para que no arranque vacío. No se puede saber quién los mandó
-- (nunca se guardó), así que van sin autor y con origen AUTOMATICO.
-- El `not exists` lo hace repetible sin duplicar.
-- ---------------------------------------------------------------------------
insert into public.reserva_email_envios
  (reserva_id, empresa_id, tipo, destinatario, usuario_id, usuario_nombre, origen, enviado_at)
select r.id, r.empresa_id, t.tipo, r.cliente_email, null, null, 'AUTOMATICO', t.enviado_at
  from public.reservas r
  cross join lateral (
    values
      ('CONFIRMACION',   r.email_confirmacion_at),
      ('RECONFIRMACION', r.email_reconfirmacion_at),
      ('RECORDATORIO',   r.email_recordatorio_at),
      ('CANCELACION',    r.email_cancelacion_at)
  ) as t(tipo, enviado_at)
 where t.enviado_at is not null
   and not exists (
     select 1 from public.reserva_email_envios e
      where e.reserva_id = r.id
        and e.tipo = t.tipo
        and e.enviado_at = t.enviado_at
   );
