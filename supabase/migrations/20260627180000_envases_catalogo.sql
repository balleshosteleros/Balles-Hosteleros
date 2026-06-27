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
-- Tipos que definen cómo llega la mercancía (sólidos, líquidos, conservas, porcionado…).
insert into public.envases (empresa_id, nombre, orden)
select e.id, x.nombre, x.orden
from public.empresas e
cross join (values
  -- Sólidos / secos
  ('Bolsa',1),('Caja',2),('Saco',3),('Malla',4),('Paquete',5),('Estuche',6),('Pack',7),
  -- Líquidos
  ('Botella',8),('Garrafa',9),('Bidón',10),('Brick',11),('Bag-in-box',12),('Damajuana',13),('Barril',14),
  -- Conservas / cierre hermético
  ('Lata',15),('Bote',16),('Frasco',17),('Tarro',18),
  -- Fresco / porcionado
  ('Bandeja',19),('Barqueta',20),('Tarrina',21),('Cubeta',22),
  -- Otros formatos de transporte
  ('Cubo',23),('Cuñete',24),('Spray',25),('Rollo',26),('Tubo',27),('Granel',28)
) as x(nombre, orden)
where not exists (select 1 from public.envases en where en.empresa_id = e.id and en.nombre = x.nombre);
