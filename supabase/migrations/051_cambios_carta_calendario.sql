-- ============================================================
-- 051_cambios_carta_calendario.sql
-- Calendario de CAMBIOS DE CARTA en NUEVAS RECETAS.
--
-- Cada cambio de carta = 5 fases semanales (una por cada fase
-- del pipeline de nuevas recetas). La fase 5 (Marketing y carta)
-- contiene la sesión de marketing → día oficial del cambio.
--
-- Idempotente.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. cambios_carta — un proceso de cambio de carta por fila
-- ────────────────────────────────────────────────────────────
create table if not exists public.cambios_carta (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  fecha_inicio date not null,
  fecha_oficial date not null,
  notas text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cambios_carta_empresa_fecha
  on public.cambios_carta(empresa_id, fecha_oficial);

-- ────────────────────────────────────────────────────────────
-- 2. cambios_carta_semana — 5 semanas (una por fase)
-- ────────────────────────────────────────────────────────────
create table if not exists public.cambios_carta_semana (
  id uuid primary key default gen_random_uuid(),
  cambio_carta_id uuid not null references public.cambios_carta(id) on delete cascade,
  fase_id uuid references public.nueva_receta_fase(id) on delete set null,
  fase_nombre text not null,
  color text not null default 'gris'
    check (color in ('azul','naranja','ambar','violeta','rosa','verde','rojo','cian','indigo','gris')),
  orden int not null check (orden between 1 and 10),
  fecha_inicio date not null,
  fecha_fin date not null,
  es_oficial boolean not null default false,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cambio_carta_id, orden)
);

create index if not exists idx_cambios_carta_semana_cambio
  on public.cambios_carta_semana(cambio_carta_id, orden);
create index if not exists idx_cambios_carta_semana_fechas
  on public.cambios_carta_semana(fecha_inicio, fecha_fin);

-- ────────────────────────────────────────────────────────────
-- 3. RLS — multi-tenant via empresa_id
-- ────────────────────────────────────────────────────────────
alter table public.cambios_carta        enable row level security;
alter table public.cambios_carta_semana enable row level security;

drop policy if exists "cambios_carta_read"  on public.cambios_carta;
drop policy if exists "cambios_carta_write" on public.cambios_carta;
create policy "cambios_carta_read" on public.cambios_carta for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
create policy "cambios_carta_write" on public.cambios_carta for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "cambios_carta_semana_read"  on public.cambios_carta_semana;
drop policy if exists "cambios_carta_semana_write" on public.cambios_carta_semana;
create policy "cambios_carta_semana_read" on public.cambios_carta_semana for select to authenticated
  using (exists (select 1 from public.cambios_carta cc
                 where cc.id = cambios_carta_semana.cambio_carta_id
                   and cc.empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())));
create policy "cambios_carta_semana_write" on public.cambios_carta_semana for all to authenticated
  using (exists (select 1 from public.cambios_carta cc
                 where cc.id = cambios_carta_semana.cambio_carta_id
                   and cc.empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())))
  with check (exists (select 1 from public.cambios_carta cc
                      where cc.id = cambios_carta_semana.cambio_carta_id
                        and cc.empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())));

-- ────────────────────────────────────────────────────────────
-- 4. Trigger para mantener fecha_oficial = fecha_inicio de la
--    semana marcada es_oficial=true (normalmente la última fase)
-- ────────────────────────────────────────────────────────────
create or replace function public.cambios_carta_recalc_oficial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fecha date;
begin
  select fecha_inicio into v_fecha
  from public.cambios_carta_semana
  where cambio_carta_id = coalesce(new.cambio_carta_id, old.cambio_carta_id)
    and es_oficial = true
  order by orden desc
  limit 1;

  if v_fecha is not null then
    update public.cambios_carta
    set fecha_oficial = v_fecha,
        updated_at = now()
    where id = coalesce(new.cambio_carta_id, old.cambio_carta_id)
      and fecha_oficial is distinct from v_fecha;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_cambios_carta_semana_oficial on public.cambios_carta_semana;
create trigger trg_cambios_carta_semana_oficial
  after insert or update of fecha_inicio, es_oficial on public.cambios_carta_semana
  for each row execute function public.cambios_carta_recalc_oficial();
