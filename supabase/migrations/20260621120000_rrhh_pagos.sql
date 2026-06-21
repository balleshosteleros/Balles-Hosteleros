-- PRP-062 Fase 1: Persistencia del modulo de Pagos/Nominas de RRHH
-- Hasta ahora /rrhh/pagos era solo UI en memoria (pagos.io fetchAll -> []).
-- Esta tabla guarda el pago de cada empleado por mes y empresa.
-- empleado_id es NULLABLE + empleado_nombre snapshot: un ex-empleado sin ficha
-- igual conserva su historico por nombre. Importes guardados verbatim de la
-- hoja (incluido total): el TOTAL es un calculo de negocio propio, NO se recomputa.
-- Idempotente: re-ejecutable sin error.

create table if not exists public.rrhh_pagos (
  id                    uuid primary key default gen_random_uuid(),
  empresa_id            uuid not null references public.empresas(id) on delete cascade,
  empleado_id          uuid references public.empleados(id) on delete set null,
  empleado_nombre      text not null,
  periodo               text not null check (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  fijo                  boolean       not null default false,
  pago                  numeric(12,2) not null default 0,
  nomina                numeric(12,2) not null default 0,
  horas_reales          numeric(8,2)  not null default 0,
  horas_trabajadas      numeric(8,2)  not null default 0,
  propina               numeric(12,2) not null default 0,
  ajuste                numeric(12,2) not null default 0, -- con signo: + suma al total, - resta
  horas_extras          numeric(12,2) not null default 0,
  bonus                 numeric(12,2) not null default 0,
  propina_mes_anterior  numeric(12,2) not null default 0,
  total                 numeric(12,2) not null default 0,
  pagado                boolean       not null default false,
  created_at            timestamptz   not null default now(),
  updated_at            timestamptz   not null default now(),
  created_by            uuid
);

-- Un pago por empleado x mes x empresa (target de upsert desde PostgREST).
-- No parcial: NULL empleado_id se considera distinto, asi que ex-empleados por
-- nombre no chocan; los empleados con ficha si quedan deduplicados.
create unique index if not exists uq_rrhh_pagos_emp_periodo
  on public.rrhh_pagos(empresa_id, empleado_id, periodo);

create index if not exists idx_rrhh_pagos_empresa_periodo
  on public.rrhh_pagos(empresa_id, periodo);

-- updated_at automatico (funcion compartida del proyecto)
drop trigger if exists trg_rrhh_pagos_updated_at on public.rrhh_pagos;
create trigger trg_rrhh_pagos_updated_at
  before update on public.rrhh_pagos
  for each row execute function set_updated_at();

-- RLS multi-tenant (patron empresas_del_usuario())
alter table public.rrhh_pagos enable row level security;

drop policy if exists rrhh_pagos_select on public.rrhh_pagos;
create policy rrhh_pagos_select on public.rrhh_pagos
  for select using (empresa_id in (select empresas_del_usuario()));

drop policy if exists rrhh_pagos_insert on public.rrhh_pagos;
create policy rrhh_pagos_insert on public.rrhh_pagos
  for insert with check (empresa_id in (select empresas_del_usuario()));

drop policy if exists rrhh_pagos_update on public.rrhh_pagos;
create policy rrhh_pagos_update on public.rrhh_pagos
  for update using (empresa_id in (select empresas_del_usuario()))
  with check (empresa_id in (select empresas_del_usuario()));

drop policy if exists rrhh_pagos_delete on public.rrhh_pagos;
create policy rrhh_pagos_delete on public.rrhh_pagos
  for delete using (empresa_id in (select empresas_del_usuario()));
