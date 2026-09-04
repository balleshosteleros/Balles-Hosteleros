-- Los 3 apartados del primer nivel de la carta, configurables por empresa.
--
-- POR QUÉ: el orden y el nombre no son iguales en todos los locales. BACANAL es
-- restaurante y abre por COMIDA; HABANA es coctelería y abre por BEBIDA. Tener
-- los rótulos fijos en el código obligaba a tocar el software para algo que es
-- una decisión de sala.
--
-- Son SIEMPRE tres como máximo (`clave` acotada): más apartados en el primer
-- nivel convierten la elección en otra lista que leer, que es justo lo que esta
-- pantalla venía a evitar.
create table if not exists carta_familias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  clave text not null check (clave in ('comida','bebida','otros')),
  nombre text not null,
  orden smallint not null default 1,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, clave)
);

comment on table carta_familias is
  'Los 3 apartados del primer nivel de la carta. Nombre y orden los decide cada empresa.';

alter table carta_familias enable row level security;

drop policy if exists carta_familias_empresa on carta_familias;
create policy carta_familias_empresa on carta_familias
  for all using (empresa_id in (select empresas_del_usuario()))
  with check (empresa_id in (select empresas_del_usuario()));
