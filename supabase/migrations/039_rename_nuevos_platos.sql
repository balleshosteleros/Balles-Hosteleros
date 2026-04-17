-- ============================================================
-- 039_rename_nuevos_platos.sql
-- Renombrado del submódulo: NUEVOS PLATOS → NUEVAS RECETAS
--
-- Idempotente:
--   - Si existe la tabla vieja (nuevos_platos): la renombra.
--   - Si no existe ninguna: crea nuevas_recetas desde cero.
--   - Renombra enums si existen (nuevo_plato_* → nueva_receta_*).
-- ============================================================

-- 1) Enums ----------------------------------------------------
do $$
begin
  if exists (select 1 from pg_type where typname='nuevo_plato_estado')
     and not exists (select 1 from pg_type where typname='nueva_receta_estado') then
    execute 'alter type nuevo_plato_estado rename to nueva_receta_estado';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_type where typname='nuevo_plato_destino')
     and not exists (select 1 from pg_type where typname='nueva_receta_destino') then
    execute 'alter type nuevo_plato_destino rename to nueva_receta_destino';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname='nueva_receta_estado') then
    create type nueva_receta_estado as enum ('propuesto', 'en_cata', 'aprobado', 'rechazado', 'en_carta');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname='nueva_receta_destino') then
    create type nueva_receta_destino as enum ('cocina', 'sala', 'ambos');
  end if;
end $$;

-- 2) Tabla ----------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='nuevos_platos')
     and not exists (select 1 from information_schema.tables
                     where table_schema='public' and table_name='nuevas_recetas') then
    execute 'alter table public.nuevos_platos rename to nuevas_recetas';
  end if;
end $$;

create table if not exists public.nuevas_recetas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  descripcion text,
  destino nueva_receta_destino not null default 'ambos',
  estado nueva_receta_estado not null default 'propuesto',
  propuesto_por uuid,
  propuesto_por_nombre text,
  fecha date not null default current_date,
  fotos_marketing boolean not null default false,
  cata_1 boolean not null default false,
  cata_2 boolean not null default false,
  grabar_producto boolean not null default false,
  ficha_proveedor boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) RLS y policies -------------------------------------------
alter table public.nuevas_recetas enable row level security;

drop policy if exists "platos_read_empresa" on public.nuevas_recetas;
drop policy if exists "platos_insert"       on public.nuevas_recetas;
drop policy if exists "platos_update"       on public.nuevas_recetas;
drop policy if exists "platos_delete"       on public.nuevas_recetas;

drop policy if exists "recetas_read_empresa" on public.nuevas_recetas;
create policy "recetas_read_empresa" on public.nuevas_recetas
  for select to authenticated
  using (empresa_id in (
    select p.empresa_id from public.profiles p where p.user_id = auth.uid()
  ));

drop policy if exists "recetas_insert" on public.nuevas_recetas;
create policy "recetas_insert" on public.nuevas_recetas
  for insert to authenticated
  with check (true);

drop policy if exists "recetas_update" on public.nuevas_recetas;
create policy "recetas_update" on public.nuevas_recetas
  for update to authenticated
  using (true);

drop policy if exists "recetas_delete" on public.nuevas_recetas;
create policy "recetas_delete" on public.nuevas_recetas
  for delete to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role in ('admin','director','gerencia')
  ));
