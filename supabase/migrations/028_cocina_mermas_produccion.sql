-- ============================================================
-- 028_cocina_mermas_produccion.sql
-- Módulo Cocina: Mermas, producción diaria, mise en place.
--
-- CONEXIONES CRUZADAS:
--   - mermas → productos (Logística), aperturas (Dirección), stock (descuento automático)
--   - produccion_diaria → partidas (Cocina existente), aperturas (Dirección), empleados (RRHH)
--   - mise_en_place → partidas, aperturas
-- ============================================================

-- ─── 1. MERMAS ─────────────────────────────────────────────
-- Registro de pérdidas de producto por turno (cocción, limpieza, caducidad…).
-- Conecta con: productos (Logística), aperturas (Dirección), stock (descuento).
-- El registro de merma puede descontar automáticamente del stock.

create table if not exists public.mermas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  producto_id     uuid not null references public.productos(id) on delete cascade,
  apertura_id     uuid references public.aperturas(id) on delete set null,
  -- Qué se perdió
  cantidad        numeric(10,3) not null check (cantidad > 0),
  unidad          text not null default 'kg',
  motivo          text not null default 'Elaboracion'
                    check (motivo in ('Elaboracion','Caducidad','Rotura','Error','Limpieza','Otro')),
  descripcion     text,
  -- Impacto económico (calculado)
  coste_unitario  numeric(10,2) default 0,
  coste_total     numeric(10,2) generated always as (cantidad * coste_unitario) stored,
  -- Descuento de stock
  descuenta_stock boolean not null default true,
  stock_descontado boolean not null default false,
  -- Trazabilidad
  registrado_por  uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_mermas_empresa
  on public.mermas(empresa_id);
create index if not exists idx_mermas_producto
  on public.mermas(producto_id);
create index if not exists idx_mermas_apertura
  on public.mermas(apertura_id);
create index if not exists idx_mermas_fecha
  on public.mermas(empresa_id, created_at desc);

create or replace function public.set_mermas_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists mermas_updated_at on public.mermas;
create trigger mermas_updated_at
  before update on public.mermas
  for each row execute function public.set_mermas_updated_at();

comment on table public.mermas is
  'Pérdidas de producto por turno. Si descuenta_stock=true, trigger actualiza stock automáticamente.';

-- ─── 2. TRIGGER: descontar stock al registrar merma ────────

create or replace function public.fn_merma_descuenta_stock()
returns trigger language plpgsql as $$
begin
  if new.descuenta_stock and not new.stock_descontado and new.producto_id is not null then
    update public.stock
    set
      cantidad_actual   = greatest(cantidad_actual - new.cantidad, 0),
      ultimo_movimiento = now()
    where producto_id = new.producto_id;

    new.stock_descontado := true;
  end if;
  return new;
end;
$$;

drop trigger if exists merma_descuenta_stock on public.mermas;
create trigger merma_descuenta_stock
  before insert on public.mermas
  for each row execute function public.fn_merma_descuenta_stock();

-- ─── 3. PRODUCCIÓN DIARIA ──────────────────────────────────
-- Registro de lo que se produce en cada turno por partida.
-- Conecta con: partidas (Cocina), aperturas (Dirección), empleados (RRHH),
--              productos (Logística — lo que se fabrica es un producto tipo elaboracion).

create table if not exists public.produccion_diaria (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  apertura_id     uuid references public.aperturas(id) on delete set null,
  partida_id      uuid references public.partidas(id) on delete set null,
  producto_id     uuid references public.productos(id) on delete set null,
  -- Lo producido
  nombre_produccion text not null,    -- nombre libre si no hay producto vinculado
  cantidad_planificada numeric(10,3) default 0,
  cantidad_producida   numeric(10,3) default 0,
  unidad          text not null default 'ud',
  -- Control
  responsable_id  uuid references public.empleados(id) on delete set null,
  hora_inicio     time,
  hora_fin        time,
  estado          text not null default 'Pendiente'
                    check (estado in ('Pendiente','En proceso','Completada','Incidencia')),
  incidencias     text,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_prod_empresa
  on public.produccion_diaria(empresa_id);
create index if not exists idx_prod_apertura
  on public.produccion_diaria(apertura_id);
create index if not exists idx_prod_partida
  on public.produccion_diaria(partida_id);

create or replace function public.set_produccion_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists produccion_updated_at on public.produccion_diaria;
create trigger produccion_updated_at
  before update on public.produccion_diaria
  for each row execute function public.set_produccion_updated_at();

-- ─── 4. MISE EN PLACE ──────────────────────────────────────
-- Checklist de puesta a punto por partida/apertura.
-- Conecta con: partidas (Cocina), aperturas (Dirección).

create table if not exists public.plantillas_mep (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  partida_id  uuid references public.partidas(id) on delete set null,
  nombre      text not null,
  turno       text check (turno in ('Mañana','Tarde','Noche','Todas')),
  tareas      jsonb not null default '[]',  -- [{nombre, orden, critica}]
  activa      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.mise_en_place (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  plantilla_id    uuid references public.plantillas_mep(id) on delete set null,
  apertura_id     uuid references public.aperturas(id) on delete set null,
  partida_id      uuid references public.partidas(id) on delete set null,
  responsable_id  uuid references public.empleados(id) on delete set null,
  fecha           date not null default current_date,
  turno           text check (turno in ('Mañana','Tarde','Noche')),
  tareas          jsonb not null default '[]',  -- [{nombre, completada, completada_at, completada_por}]
  completado_pct  integer default 0,
  estado          text not null default 'Pendiente'
                    check (estado in ('Pendiente','En progreso','Completado')),
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_mep_empresa    on public.mise_en_place(empresa_id);
create index if not exists idx_mep_apertura   on public.mise_en_place(apertura_id);
create index if not exists idx_mep_fecha      on public.mise_en_place(empresa_id, fecha desc);

create or replace function public.set_mep_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists mep_updated_at on public.mise_en_place;
create trigger mep_updated_at
  before update on public.mise_en_place
  for each row execute function public.set_mep_updated_at();

drop trigger if exists plantillas_mep_updated_at on public.plantillas_mep;
create trigger plantillas_mep_updated_at
  before update on public.plantillas_mep
  for each row execute function public.set_mep_updated_at();

-- ─── 5. VINCULAR fichas_tecnicas → productos ───────────────
-- Las fichas técnicas existentes no tienen FK a productos.
-- Añadir producto_venta_id para enlazar la ficha con el plato del menú.

alter table public.fichas_tecnicas
  add column if not exists producto_id uuid references public.productos(id) on delete set null;

comment on column public.fichas_tecnicas.producto_id is
  'Producto tipo venta al que corresponde esta ficha técnica. Permite calcular food cost real.';

create index if not exists idx_fichas_producto
  on public.fichas_tecnicas(producto_id) where producto_id is not null;

-- ─── 6. RLS ────────────────────────────────────────────────

alter table public.mermas            enable row level security;
alter table public.produccion_diaria enable row level security;
alter table public.plantillas_mep    enable row level security;
alter table public.mise_en_place     enable row level security;

-- Mermas
create policy "merm_read" on public.mermas for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "merm_manage" on public.mermas for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Producción
create policy "prod_read" on public.produccion_diaria for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "prod_manage" on public.produccion_diaria for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Plantillas MEP
create policy "plmep_read" on public.plantillas_mep for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "plmep_manage" on public.plantillas_mep for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Mise en place
create policy "mep_read" on public.mise_en_place for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "mep_manage" on public.mise_en_place for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
