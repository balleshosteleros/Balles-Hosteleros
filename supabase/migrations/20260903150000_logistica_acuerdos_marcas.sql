-- Control de acuerdos (Logística): marcas con las que hay acuerdo comercial.
-- Una MARCA no es un proveedor: es el fabricante/distribuidora con la que se
-- pacta un rapel, pero la compra se hace a través de proveedores. Por eso vive
-- en su propia tabla y sus referencias apuntan a productos de compra.

create table if not exists public.logistica_marcas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  razon_social text,
  cif text,
  -- Vigencia del acuerdo firmado con la marca.
  fecha_inicio date,
  fecha_fin date,
  -- Contrapartidas pactadas (visibilidad, activaciones, material...).
  visibilidad text,
  observaciones text,
  estado text not null default 'Activo' check (estado in ('Activo','Inactivo')),
  numero_secuencial integer,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, nombre)
);

-- Referencias del acuerdo: cada producto de compra incluido, con su rapel por
-- unidad y el objetivo pactado para el periodo.
create table if not exists public.logistica_marca_referencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  marca_id uuid not null references public.logistica_marcas(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete cascade,
  -- €/unidad que abona la marca por cada unidad comprada.
  rapel_unidad numeric not null default 0,
  -- Unidades comprometidas en el acuerdo (0 = sin objetivo).
  objetivo numeric not null default 0,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (marca_id, producto_id)
);

create index if not exists idx_logistica_marcas_empresa
  on public.logistica_marcas(empresa_id);
create index if not exists idx_logistica_marca_ref_marca
  on public.logistica_marca_referencias(marca_id);
create index if not exists idx_logistica_marca_ref_producto
  on public.logistica_marca_referencias(producto_id);

alter table public.logistica_marcas enable row level security;
alter table public.logistica_marca_referencias enable row level security;

drop policy if exists logistica_marcas_all on public.logistica_marcas;
create policy logistica_marcas_all on public.logistica_marcas
  for all to authenticated
  using (empresa_id in (select empresas_del_usuario()))
  with check (empresa_id in (select empresas_del_usuario()));

drop policy if exists logistica_marca_referencias_all on public.logistica_marca_referencias;
create policy logistica_marca_referencias_all on public.logistica_marca_referencias
  for all to authenticated
  using (empresa_id in (select empresas_del_usuario()))
  with check (empresa_id in (select empresas_del_usuario()));
