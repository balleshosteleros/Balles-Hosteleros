-- ─── 080: Histórico de precios de compra por producto ───────────
-- Permite registrar cómo evoluciona el precio de compra (+ IVA) de un producto.
-- El "precio actual" = registro con mayor fecha_inicio <= today.

create table if not exists public.producto_precios_compra (
  id              uuid primary key default gen_random_uuid(),
  producto_id     uuid not null references public.productos(id) on delete cascade,
  precio          numeric(12,4) not null check (precio >= 0),
  iva             text,                       -- "0%", "4%", "10%", "21%" o null
  fecha_inicio    date not null default current_date,
  observaciones   text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_ppc_producto_fecha
  on public.producto_precios_compra(producto_id, fecha_inicio desc);

comment on table  public.producto_precios_compra is
  'Histórico de precios de compra por producto. El último por fecha_inicio es el vigente.';
comment on column public.producto_precios_compra.fecha_inicio is
  'Fecha desde la que aplica este precio. Default = hoy.';

-- ─── RLS ────────────────────────────────────────────────────────
alter table public.producto_precios_compra enable row level security;

-- Acceso vía producto → empresa (mismo patrón que ingredientes_proveedor)
create policy "ppc_read" on public.producto_precios_compra
  for select to authenticated using (true);
create policy "ppc_manage" on public.producto_precios_compra
  for all to authenticated using (true) with check (true);

-- ─── Backfill: migrar precio_compra existente ───────────────────
-- Si el producto ya tiene un precioCompra (texto libre tipo "12,50 €/kg"),
-- intentamos extraer el número y crear la primera entrada del histórico
-- usando updated_at como fecha_inicio. Sólo se hace para productos compra activos.

do $$
declare
  r record;
  v_precio numeric;
  v_clean text;
begin
  for r in
    select pr.id, pr.precio_compra, pr.updated_at
    from public.productos pr
    where pr.tipo = 'compra'
      and pr.precio_compra is not null
      and pr.precio_compra ~ '[0-9]'
      and not exists (
        select 1 from public.producto_precios_compra ppc where ppc.producto_id = pr.id
      )
  loop
    -- Extrae solo dígitos, coma y punto, y normaliza coma → punto.
    v_clean := regexp_replace(
                 regexp_replace(r.precio_compra, '[^0-9,\.]', '', 'g'),
                 ',', '.'
               );
    if v_clean is null or v_clean = '' or v_clean = '.' then
      continue;
    end if;
    begin
      v_precio := v_clean::numeric;
    exception when others then
      continue;
    end;
    if v_precio < 0 then
      continue;
    end if;
    insert into public.producto_precios_compra (producto_id, precio, fecha_inicio, observaciones)
    values (
      r.id,
      v_precio,
      coalesce(r.updated_at::date, current_date),
      'Migrado automáticamente desde el campo previo de precio.'
    );
  end loop;
end $$;
