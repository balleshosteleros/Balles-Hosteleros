-- Concepto de cuenta/tenant: GRUPOS.
-- Una cuenta es Individual (1 empresa) o Grupo (>=2 empresas). Toda empresa
-- pertenece a un grupo. Copiar/duplicar empleados y el acceso multiempresa
-- operan DENTRO del grupo (no por el acceso personal del admin).

create table if not exists public.grupos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz not null default now()
);

-- Solo el service-role (acciones de servidor) accede a grupos. RLS activa sin
-- politica = denegado a clientes autenticados, abierto a service-role.
alter table public.grupos enable row level security;

alter table public.empresas
  add column if not exists grupo_id uuid references public.grupos(id) on delete set null;
create index if not exists idx_empresas_grupo_id on public.empresas(grupo_id);

-- Seed idempotente: Grupo Hostelero = BACANAL + HABANA.
insert into public.grupos (nombre)
select 'Grupo Hostelero'
where not exists (select 1 from public.grupos where nombre = 'Grupo Hostelero');

update public.empresas e
set grupo_id = g.id
from public.grupos g
where g.nombre = 'Grupo Hostelero'
  and e.id in (
    'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47',  -- BACANAL
    '00000000-0000-0000-0000-000000000001'   -- HABANA
  )
  and e.grupo_id is distinct from g.id;
