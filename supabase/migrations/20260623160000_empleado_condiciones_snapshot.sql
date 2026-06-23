-- Condiciones PROPIAS del empleado (snapshot copiado del nivel del puesto al
-- contratar). Editar luego el nivel del puesto NO afecta a este snapshot.
create table if not exists public.empleado_condiciones (
  empleado_id      uuid primary key references public.empleados(id) on delete cascade,
  empresa_id       uuid not null references public.empresas(id) on delete cascade,
  puesto_id        uuid,            -- puesto real vinculado (informativo)
  nivel            int,             -- nivel de origen del snapshot
  nomina_neta      numeric default 0,
  efectivo_extra   numeric default 0,
  salario_neto     numeric default 0,
  jornada_contrato text,
  horas_semanales  numeric,
  dias_libres      int,
  vacaciones       text,
  horario_semanal  jsonb default '[]'::jsonb,
  primer_dia       date,            -- primer día de trabajo
  tipo_contrato    text,            -- 'indefinido' | 'temporal'
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.empleado_condiciones enable row level security;

drop policy if exists empleado_condiciones_sel on public.empleado_condiciones;
create policy empleado_condiciones_sel on public.empleado_condiciones
  for select using (empresa_id in (select empresas_del_usuario()));

drop policy if exists empleado_condiciones_ins on public.empleado_condiciones;
create policy empleado_condiciones_ins on public.empleado_condiciones
  for insert with check (empresa_id in (select empresas_del_usuario()));

drop policy if exists empleado_condiciones_upd on public.empleado_condiciones;
create policy empleado_condiciones_upd on public.empleado_condiciones
  for update using (empresa_id in (select empresas_del_usuario()));
