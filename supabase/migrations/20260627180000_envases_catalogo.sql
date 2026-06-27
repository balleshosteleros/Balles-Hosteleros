-- Catálogo de ENVASES (indicador independiente: Bolsa, Caja, Saco, Botella…).
create table if not exists public.envases (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  orden integer not null default 0,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, nombre)
);

alter table public.envases enable row level security;

create policy envases_select on public.envases for select
  using (
    (exists (select 1 from usuario_empresas ue where ue.user_id = (select auth.uid()) and ue.empresa_id = envases.empresa_id))
    or (exists (select 1 from usuarios p where p.user_id = (select auth.uid()) and p.empresa_id = envases.empresa_id))
  );

create policy envases_write on public.envases for all
  using (
    (exists (select 1 from usuario_empresas ue where ue.user_id = (select auth.uid()) and ue.empresa_id = envases.empresa_id))
    or (exists (select 1 from usuarios p where p.user_id = (select auth.uid()) and p.empresa_id = envases.empresa_id))
  )
  with check (
    (exists (select 1 from usuario_empresas ue where ue.user_id = (select auth.uid()) and ue.empresa_id = envases.empresa_id))
    or (exists (select 1 from usuarios p where p.user_id = (select auth.uid()) and p.empresa_id = envases.empresa_id))
  );

-- Semilla de envases para las empresas existentes.
insert into public.envases (empresa_id, nombre, orden)
select e.id, x.nombre, x.orden
from public.empresas e
cross join (values ('Bolsa',1),('Caja',2),('Saco',3),('Botella',4)) as x(nombre, orden)
where not exists (select 1 from public.envases en where en.empresa_id = e.id and en.nombre = x.nombre);
