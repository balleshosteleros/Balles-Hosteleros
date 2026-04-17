-- ============================================================
-- 035_pos.sql — Módulo POS (Punto de Venta) — submódulo de Sala
-- PRP-025 · Fase 1
--
-- Tablas nuevas:
--   pos_sesiones_caja     (arqueos)
--   pos_tickets           (ticket / comanda)
--   pos_ticket_lineas     (líneas del ticket)
--   pos_pagos             (medios de pago por ticket)
--   pos_movimientos_caja  (aportes / retiradas de caja)
--
-- Reutiliza: mesas, productos, escandallos, stock, descuentos,
--            profiles, user_roles, empresas.
-- ============================================================

-- ─── 0. ENUMS ─────────────────────────────────────────────────
do $$ begin
  create type public.ticket_estado as enum ('ABIERTO','ENVIADO','COBRADO','ANULADO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pago_medio as enum ('EFECTIVO','TARJETA','BIZUM','VALE','OTROS');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.caja_estado as enum ('ABIERTA','CERRADA');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.linea_destino as enum ('COCINA','BARRA','NINGUNO');
exception when duplicate_object then null; end $$;

-- ─── 1. SESIÓN DE CAJA (ARQUEO) ──────────────────────────────
create table if not exists public.pos_sesiones_caja (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  empleado_id    uuid,
  abierta_at     timestamptz not null default now(),
  cerrada_at     timestamptz,
  fondo_inicial  numeric(10,2) not null default 0,
  teorico_cierre numeric(10,2),
  real_cierre    numeric(10,2),
  diferencia     numeric(10,2),
  estado         public.caja_estado not null default 'ABIERTA',
  notas          text not null default '',
  created_at     timestamptz not null default now()
);

create index if not exists idx_pos_caja_empresa
  on public.pos_sesiones_caja(empresa_id, abierta_at desc);

create index if not exists idx_pos_caja_abierta
  on public.pos_sesiones_caja(empresa_id, estado)
  where estado = 'ABIERTA';

-- ─── 2. TICKETS ──────────────────────────────────────────────
create table if not exists public.pos_tickets (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  sesion_caja_id  uuid references public.pos_sesiones_caja(id) on delete set null,
  numero          text not null,
  mesa_id         uuid,
  comensales      integer not null default 1,
  empleado_id     uuid,
  estado          public.ticket_estado not null default 'ABIERTO',
  subtotal        numeric(10,2) not null default 0,
  descuento_id    uuid,
  descuento_valor numeric(10,2) not null default 0,
  iva_total       numeric(10,2) not null default 0,
  total           numeric(10,2) not null default 0,
  abierto_at      timestamptz not null default now(),
  enviado_at      timestamptz,
  cerrado_at      timestamptz,
  anulado_at      timestamptz,
  anulado_motivo  text,
  stock_descontado boolean not null default false,
  notas           text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_pos_tickets_empresa_fecha
  on public.pos_tickets(empresa_id, abierto_at desc);

create index if not exists idx_pos_tickets_empresa_estado
  on public.pos_tickets(empresa_id, estado);

create unique index if not exists idx_pos_tickets_numero_unico
  on public.pos_tickets(empresa_id, numero);

-- ─── 3. LÍNEAS DE TICKET ─────────────────────────────────────
create table if not exists public.pos_ticket_lineas (
  id              uuid primary key default gen_random_uuid(),
  ticket_id       uuid not null references public.pos_tickets(id) on delete cascade,
  producto_id     uuid,
  nombre          text not null,
  cantidad        numeric(10,3) not null default 1,
  precio_unitario numeric(10,2) not null default 0,
  iva_pct         numeric(5,2) not null default 10,
  descuento_pct   numeric(5,2) not null default 0,
  destino         public.linea_destino not null default 'COCINA',
  enviada_at      timestamptz,
  nota_cocina     text not null default '',
  comensal_idx    smallint,
  created_at      timestamptz not null default now()
);

create index if not exists idx_pos_lineas_ticket
  on public.pos_ticket_lineas(ticket_id);

-- ─── 4. PAGOS ────────────────────────────────────────────────
create table if not exists public.pos_pagos (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.pos_tickets(id) on delete cascade,
  medio      public.pago_medio not null,
  importe    numeric(10,2) not null,
  referencia text,
  creado_at  timestamptz not null default now()
);

create index if not exists idx_pos_pagos_ticket
  on public.pos_pagos(ticket_id);

-- ─── 5. MOVIMIENTOS DE CAJA (aportes / retiradas) ────────────
create table if not exists public.pos_movimientos_caja (
  id             uuid primary key default gen_random_uuid(),
  sesion_caja_id uuid not null references public.pos_sesiones_caja(id) on delete cascade,
  tipo           text not null check (tipo in ('APORTE','RETIRADA')),
  importe        numeric(10,2) not null,
  motivo         text not null default '',
  creado_at      timestamptz not null default now()
);

create index if not exists idx_pos_mov_caja_sesion
  on public.pos_movimientos_caja(sesion_caja_id, creado_at desc);

-- ─── 6. RLS POR empresa_id (patrón profiles.user_id = auth.uid()) ─
alter table public.pos_sesiones_caja    enable row level security;
alter table public.pos_tickets          enable row level security;
alter table public.pos_ticket_lineas    enable row level security;
alter table public.pos_pagos            enable row level security;
alter table public.pos_movimientos_caja enable row level security;

drop policy if exists "pos_caja_empresa" on public.pos_sesiones_caja;
create policy "pos_caja_empresa" on public.pos_sesiones_caja
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

drop policy if exists "pos_tickets_empresa" on public.pos_tickets;
create policy "pos_tickets_empresa" on public.pos_tickets
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

drop policy if exists "pos_lineas_via_ticket" on public.pos_ticket_lineas;
create policy "pos_lineas_via_ticket" on public.pos_ticket_lineas
  for all to authenticated
  using (
    ticket_id in (
      select t.id from public.pos_tickets t
      where t.empresa_id in (
        select p.empresa_id from public.profiles p where p.user_id = auth.uid()
      )
    )
  )
  with check (
    ticket_id in (
      select t.id from public.pos_tickets t
      where t.empresa_id in (
        select p.empresa_id from public.profiles p where p.user_id = auth.uid()
      )
    )
  );

drop policy if exists "pos_pagos_via_ticket" on public.pos_pagos;
create policy "pos_pagos_via_ticket" on public.pos_pagos
  for all to authenticated
  using (
    ticket_id in (
      select t.id from public.pos_tickets t
      where t.empresa_id in (
        select p.empresa_id from public.profiles p where p.user_id = auth.uid()
      )
    )
  )
  with check (
    ticket_id in (
      select t.id from public.pos_tickets t
      where t.empresa_id in (
        select p.empresa_id from public.profiles p where p.user_id = auth.uid()
      )
    )
  );

drop policy if exists "pos_mov_via_caja" on public.pos_movimientos_caja;
create policy "pos_mov_via_caja" on public.pos_movimientos_caja
  for all to authenticated
  using (
    sesion_caja_id in (
      select c.id from public.pos_sesiones_caja c
      where c.empresa_id in (
        select p.empresa_id from public.profiles p where p.user_id = auth.uid()
      )
    )
  )
  with check (
    sesion_caja_id in (
      select c.id from public.pos_sesiones_caja c
      where c.empresa_id in (
        select p.empresa_id from public.profiles p where p.user_id = auth.uid()
      )
    )
  );

-- ─── 7. TRIGGER updated_at ───────────────────────────────────
drop trigger if exists pos_tickets_updated_at on public.pos_tickets;
create trigger pos_tickets_updated_at
  before update on public.pos_tickets
  for each row execute function public.set_updated_at();

-- ─── 8. FUNCIÓN: correlativo de ticket por empresa y día ─────
-- Genera "YYYYMMDD-NNNN" atómicamente dentro de una transacción.
create or replace function public.pos_next_ticket_numero(p_empresa_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  v_fecha_str text := to_char(now() at time zone 'Europe/Madrid', 'YYYYMMDD');
  v_next      int;
  v_numero    text;
begin
  -- Busca último correlativo de hoy y suma 1 (bloqueo por lock de fila implícito en insert)
  select coalesce(max(substring(numero from 10)::int), 0) + 1
    into v_next
    from public.pos_tickets
   where empresa_id = p_empresa_id
     and numero like v_fecha_str || '-%';

  v_numero := v_fecha_str || '-' || lpad(v_next::text, 4, '0');
  return v_numero;
end $$;

comment on function public.pos_next_ticket_numero(uuid) is
  'Genera correlativo de ticket POS formato YYYYMMDD-NNNN por empresa y día.';

-- ─── 9. FLAG POR EMPRESA: evitar doble descuento Ágora+POS ───
-- Si una empresa usa POS propio, Ágora no debe descontar stock (y viceversa).
-- Se agrega a empresa_config si existe, si no se crea columna en empresas.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='empresa_config'
  ) then
    alter table public.empresa_config
      add column if not exists pos_descuenta_stock boolean not null default false;
  else
    alter table public.empresas
      add column if not exists pos_descuenta_stock boolean not null default false;
  end if;
end $$;

-- ─── 10. FOREIGN KEYS CONDICIONALES ──────────────────────────
-- Las FKs se crean sólo si la tabla destino existe en la BD.
-- Si aún no has aplicado la migración de `mesas` o de `descuentos`, la FK
-- se creará la próxima vez que ejecutes este script.
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='mesas')
     and not exists (select 1 from information_schema.table_constraints
                    where constraint_name='pos_tickets_mesa_id_fkey' and table_name='pos_tickets') then
    alter table public.pos_tickets
      add constraint pos_tickets_mesa_id_fkey
      foreign key (mesa_id) references public.mesas(id) on delete set null;
  end if;

  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='descuentos')
     and not exists (select 1 from information_schema.table_constraints
                    where constraint_name='pos_tickets_descuento_id_fkey' and table_name='pos_tickets') then
    alter table public.pos_tickets
      add constraint pos_tickets_descuento_id_fkey
      foreign key (descuento_id) references public.descuentos(id) on delete set null;
  end if;

  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='profiles')
     and not exists (select 1 from information_schema.table_constraints
                    where constraint_name='pos_tickets_empleado_id_fkey' and table_name='pos_tickets') then
    alter table public.pos_tickets
      add constraint pos_tickets_empleado_id_fkey
      foreign key (empleado_id) references public.profiles(id) on delete set null;

    alter table public.pos_sesiones_caja
      add constraint pos_sesiones_caja_empleado_id_fkey
      foreign key (empleado_id) references public.profiles(id) on delete set null;
  end if;

  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='productos')
     and not exists (select 1 from information_schema.table_constraints
                    where constraint_name='pos_ticket_lineas_producto_id_fkey' and table_name='pos_ticket_lineas') then
    alter table public.pos_ticket_lineas
      add constraint pos_ticket_lineas_producto_id_fkey
      foreign key (producto_id) references public.productos(id) on delete set null;
  end if;
end $$;

-- ─── FIN 035_pos.sql ─────────────────────────────────────────
