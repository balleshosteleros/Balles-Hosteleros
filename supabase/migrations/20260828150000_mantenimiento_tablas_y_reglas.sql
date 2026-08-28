-- MANTENIMIENTO: tablas que faltaban + campos obligatorios + actualizaciones.
--
-- Las tablas de mantenimiento nunca llegaron a crearse: la migracion 009 fallo
-- en su politica RLS (referenciaba public.profiles, renombrada a usuarios) y,
-- al estar escrita con "if not exists", quedo marcada como aplicada sin error.
-- De sus 9 tablas se crearon 7; las 2 de mantenimiento no.
--
-- Se recrean aqui con empresa_id uuid (coherente con el resto del sistema) y
-- RLS via empresas_del_usuario(). Idempotente.

------------------------------------------------------------------
-- 1. Tablas
------------------------------------------------------------------
create table if not exists public.mantenimiento (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  desperfecto text not null,
  local_nombre text not null,
  estado text not null default 'PENDIENTE',
  gravedad text not null default 'LEVE',
  apunta_desperfecto text,
  reparador text,
  comentarios text,
  fecha_publicado date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mantenimiento_empresa on public.mantenimiento(empresa_id);
create index if not exists idx_mantenimiento_estado on public.mantenimiento(empresa_id, estado);

create table if not exists public.mantenimiento_actualizaciones (
  id uuid primary key default gen_random_uuid(),
  incidencia_id uuid not null references public.mantenimiento(id) on delete cascade,
  texto text not null,
  apuntado_por text,
  fecha timestamptz not null default now()
);

create index if not exists idx_mant_act_incidencia
  on public.mantenimiento_actualizaciones(incidencia_id);

------------------------------------------------------------------
-- 2. RLS: aislamiento por empresa activa
------------------------------------------------------------------
alter table public.mantenimiento enable row level security;
alter table public.mantenimiento_actualizaciones enable row level security;

drop policy if exists mantenimiento_read on public.mantenimiento;
drop policy if exists mantenimiento_write on public.mantenimiento;

create policy mantenimiento_read on public.mantenimiento
  for select to authenticated
  using (empresa_id in (select empresas_del_usuario()));

create policy mantenimiento_write on public.mantenimiento
  for all to authenticated
  using (empresa_id in (select empresas_del_usuario()))
  with check (empresa_id in (select empresas_del_usuario()));

drop policy if exists mant_act_read on public.mantenimiento_actualizaciones;
drop policy if exists mant_act_write on public.mantenimiento_actualizaciones;

create policy mant_act_read on public.mantenimiento_actualizaciones
  for select to authenticated
  using (exists (
    select 1 from public.mantenimiento m
    where m.id = incidencia_id
      and m.empresa_id in (select empresas_del_usuario())
  ));

create policy mant_act_write on public.mantenimiento_actualizaciones
  for all to authenticated
  using (exists (
    select 1 from public.mantenimiento m
    where m.id = incidencia_id
      and m.empresa_id in (select empresas_del_usuario())
  ))
  with check (exists (
    select 1 from public.mantenimiento m
    where m.id = incidencia_id
      and m.empresa_id in (select empresas_del_usuario())
  ));

------------------------------------------------------------------
-- 3. Actualizaciones: resultado y tiempo dedicado
--    Cada actualizacion registra en que quedo el trabajo (TERMINADO o
--    EN PROGRESO) y cuanto tiempo se le dedico, en tramos de 15 minutos
--    desde 15 min hasta 6 horas (360 min).
------------------------------------------------------------------
alter table public.mantenimiento_actualizaciones
  add column if not exists resultado text,
  add column if not exists minutos integer;

update public.mantenimiento_actualizaciones
set resultado = coalesce(resultado, 'EN PROGRESO'),
    minutos = coalesce(minutos, 15)
where resultado is null or minutos is null;

alter table public.mantenimiento_actualizaciones
  alter column resultado set not null,
  alter column minutos set not null;

------------------------------------------------------------------
-- 4. Todos los campos obligatorios
--    Una incidencia a medio rellenar no sirve para reparar ni para
--    reclamar al seguro. Los comentarios exigen un minimo de texto para
--    que quede realmente descrita por quien no la apunto.
------------------------------------------------------------------
update public.mantenimiento
set comentarios = 'PENDIENTE DE DESCRIBIR - revisar y completar'
where comentarios is null or btrim(comentarios) = '';

do $$
begin
  -- Incidencias
  if not exists (select 1 from pg_constraint where conname = 'mantenimiento_estado_chk') then
    alter table public.mantenimiento add constraint mantenimiento_estado_chk
      check (estado in ('PENDIENTE','EN PROGRESO','ESCALADO','TERMINADO'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mantenimiento_gravedad_chk') then
    alter table public.mantenimiento add constraint mantenimiento_gravedad_chk
      check (gravedad in ('LEVE','GRAVE','MUY GRAVE'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mantenimiento_apunta_obligatorio') then
    alter table public.mantenimiento add constraint mantenimiento_apunta_obligatorio
      check (apunta_desperfecto is not null and btrim(apunta_desperfecto) <> '');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mantenimiento_reparador_obligatorio') then
    alter table public.mantenimiento add constraint mantenimiento_reparador_obligatorio
      check (reparador is not null and btrim(reparador) <> '');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mantenimiento_desperfecto_obligatorio') then
    alter table public.mantenimiento add constraint mantenimiento_desperfecto_obligatorio
      check (btrim(desperfecto) <> '');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mantenimiento_local_obligatorio') then
    alter table public.mantenimiento add constraint mantenimiento_local_obligatorio
      check (btrim(local_nombre) <> '');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mantenimiento_comentarios_min') then
    alter table public.mantenimiento add constraint mantenimiento_comentarios_min
      check (comentarios is not null and length(btrim(comentarios)) >= 15);
  end if;

  -- Actualizaciones
  if not exists (select 1 from pg_constraint where conname = 'mant_act_resultado_chk') then
    alter table public.mantenimiento_actualizaciones add constraint mant_act_resultado_chk
      check (resultado in ('TERMINADO','EN PROGRESO'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mant_act_minutos_chk') then
    alter table public.mantenimiento_actualizaciones add constraint mant_act_minutos_chk
      check (minutos between 15 and 360 and minutos % 15 = 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mant_act_texto_min') then
    alter table public.mantenimiento_actualizaciones add constraint mant_act_texto_min
      check (length(btrim(texto)) >= 15);
  end if;
end $$;
