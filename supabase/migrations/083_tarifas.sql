-- ─── 083: Tarifas de venta ─────────────────────────────────────
-- Cada empresa define un catálogo de tarifas (Tarifa General, Terraza,
-- Happy Hour, Grupos, …). Cada producto de venta puede tener un precio
-- diferente por tarifa. Una tarifa es la "default": cuando no hay
-- precio específico para ella, se usa productos.precio_venta.

create table if not exists public.tarifas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nombre      text not null,
  descripcion text,
  es_default  boolean not null default false,
  activa      boolean not null default true,
  orden       integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists idx_tarifas_empresa_nombre
  on public.tarifas(empresa_id, lower(nombre));

-- Sólo una tarifa default por empresa
create unique index if not exists idx_tarifas_empresa_default
  on public.tarifas(empresa_id)
  where es_default;

create table if not exists public.producto_tarifa_precios (
  id           uuid primary key default gen_random_uuid(),
  producto_id  uuid not null references public.productos(id) on delete cascade,
  tarifa_id    uuid not null references public.tarifas(id) on delete cascade,
  precio       numeric(12,4) not null check (precio >= 0),
  iva          text,                           -- "0%", "4%", "10%", "21%" o null
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (producto_id, tarifa_id)
);

create index if not exists idx_ptp_producto
  on public.producto_tarifa_precios(producto_id);

create index if not exists idx_ptp_tarifa
  on public.producto_tarifa_precios(tarifa_id);

comment on table public.tarifas is
  'Catálogo de tarifas de venta por empresa (Tarifa General, Terraza, Happy Hour, Grupos…).';
comment on column public.tarifas.es_default is
  'Marca la tarifa default de la empresa (sólo una). La default usa productos.precio_venta cuando no hay precio específico.';
comment on table public.producto_tarifa_precios is
  'Precio de venta de un producto bajo una tarifa concreta. Si no hay registro para una tarifa, se cae al precio_venta del producto.';

-- ─── RLS ─────────────────────────────────────────────────────────
alter table public.tarifas enable row level security;
alter table public.producto_tarifa_precios enable row level security;

drop policy if exists tarifas_read on public.tarifas;
create policy tarifas_read on public.tarifas
  for select to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

drop policy if exists tarifas_manage on public.tarifas;
create policy tarifas_manage on public.tarifas
  for all to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  )
  with check (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

-- precios: acceso vía producto → empresa (mismo patrón que ingredientes_proveedor)
drop policy if exists ptp_read on public.producto_tarifa_precios;
create policy ptp_read on public.producto_tarifa_precios
  for select to authenticated using (true);

drop policy if exists ptp_manage on public.producto_tarifa_precios;
create policy ptp_manage on public.producto_tarifa_precios
  for all to authenticated using (true) with check (true);

-- ─── Trigger updated_at ──────────────────────────────────────────
create or replace function public.tarifas_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tarifas_updated_at on public.tarifas;
create trigger tarifas_updated_at
  before update on public.tarifas
  for each row execute function public.tarifas_set_updated_at();

drop trigger if exists ptp_updated_at on public.producto_tarifa_precios;
create trigger ptp_updated_at
  before update on public.producto_tarifa_precios
  for each row execute function public.tarifas_set_updated_at();

-- ─── Backfill: sembrar Tarifa General por empresa ────────────────
insert into public.tarifas (empresa_id, nombre, descripcion, es_default, activa, orden)
select e.id, 'Tarifa General', 'Tarifa por defecto de la empresa', true, true, 0
from public.empresas e
where not exists (
  select 1 from public.tarifas t where t.empresa_id = e.id and t.es_default
);
