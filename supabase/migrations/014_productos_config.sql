-- 014. Configuración dinámica de taxonomías de productos
-- Almacena categorías, familias y estados por empresa y tipo de producto.

create table if not exists public.productos_config (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  tipo       text not null check (tipo in ('compra', 'venta', 'elaboracion', 'global')),
  seccion    text not null check (seccion in ('categorias', 'familias', 'estados')),
  valores    text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint uq_productos_config unique (empresa_id, tipo, seccion)
);

-- Actualizar updated_at automáticamente
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_productos_config_updated_at on public.productos_config;
create trigger trg_productos_config_updated_at
  before update on public.productos_config
  for each row execute function public.set_updated_at();

-- RLS
alter table public.productos_config enable row level security;

create policy "empresa puede ver su config"
  on public.productos_config for select
  using (
    empresa_id in (
      select empresa_id from public.profiles where user_id = auth.uid()
    )
  );

create policy "empresa puede gestionar su config"
  on public.productos_config for all
  using (
    empresa_id in (
      select empresa_id from public.profiles where user_id = auth.uid()
    )
  )
  with check (
    empresa_id in (
      select empresa_id from public.profiles where user_id = auth.uid()
    )
  );
