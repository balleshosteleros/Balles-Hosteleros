-- ============================================================
-- 043_fichas_tecnicas_repair.sql
-- Re-crea fichas_tecnicas + ingredientes_ficha si no existen.
-- (La migración 010 parece no haber corrido en este proyecto.)
--
-- Además: añade el FK nuevas_recetas.ficha_tecnica_id → fichas_tecnicas(id)
-- que quedó pendiente en 042 por la ausencia de la tabla destino.
--
-- Idempotente — seguro de re-ejecutar.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Tabla fichas_tecnicas
-- ────────────────────────────────────────────────────────────
create table if not exists public.fichas_tecnicas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  categoria text,
  estado text not null default 'Activa'
    check (estado in ('Activa','Inactiva','Archivada','Borrador')),
  partida text,
  porciones integer default 1,
  tiempo_preparacion integer,          -- minutos
  elaboracion text,
  descripcion text,
  coste_total numeric(10,2) default 0,
  pvp numeric(10,2) default 0,
  margen_pct numeric(5,2) default 0,
  alergenos text[] default '{}',
  etiquetas text[] default '{}',
  foto_url text,
  notas text,
  origen_receta_id uuid,               -- vínculo inverso a nuevas_recetas (si nació de un pipeline)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_fichas_tecnicas_empresa
  on public.fichas_tecnicas(empresa_id);
create index if not exists idx_fichas_tecnicas_nombre
  on public.fichas_tecnicas(empresa_id, nombre);

-- ────────────────────────────────────────────────────────────
-- 2. Tabla ingredientes_ficha
-- ────────────────────────────────────────────────────────────
create table if not exists public.ingredientes_ficha (
  id uuid primary key default gen_random_uuid(),
  ficha_id uuid not null references public.fichas_tecnicas(id) on delete cascade,
  producto_id uuid references public.productos(id) on delete set null,
  nombre text not null,
  cantidad numeric(10,3) not null default 0,
  unidad text not null default 'g',
  coste_unitario numeric(10,2) default 0,
  coste_total numeric(10,2) default 0,
  prioridad text not null default 'secundario'
    check (prioridad in ('principal','secundario')),
  orden integer default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_ingredientes_ficha
  on public.ingredientes_ficha(ficha_id, orden);

-- ────────────────────────────────────────────────────────────
-- 3. RLS
-- ────────────────────────────────────────────────────────────
alter table public.fichas_tecnicas   enable row level security;
alter table public.ingredientes_ficha enable row level security;

drop policy if exists "ft_read"   on public.fichas_tecnicas;
drop policy if exists "ft_write"  on public.fichas_tecnicas;
create policy "ft_read" on public.fichas_tecnicas for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
create policy "ft_write" on public.fichas_tecnicas for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "if_read"   on public.ingredientes_ficha;
drop policy if exists "if_write"  on public.ingredientes_ficha;
create policy "if_read" on public.ingredientes_ficha for select to authenticated
  using (exists (select 1 from public.fichas_tecnicas f
                 where f.id = ficha_id
                   and f.empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())));
create policy "if_write" on public.ingredientes_ficha for all to authenticated
  using (true) with check (true);

-- ────────────────────────────────────────────────────────────
-- 4. Ahora que fichas_tecnicas existe, cerrar el FK pendiente de 042
--    Usa pg_constraint (fiable) en vez de information_schema.
-- ────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where c.conname = 'nuevas_recetas_ficha_tecnica_id_fkey'
      and t.relname = 'nuevas_recetas'
      and n.nspname = 'public'
  ) then
    alter table public.nuevas_recetas
      add constraint nuevas_recetas_ficha_tecnica_id_fkey
      foreign key (ficha_tecnica_id)
      references public.fichas_tecnicas(id) on delete set null;
  end if;
end $$;

-- ────────────────────────────────────────────────────────────
-- 5. Trigger updated_at
-- ────────────────────────────────────────────────────────────
drop trigger if exists trg_fichas_tecnicas_updated on public.fichas_tecnicas;
create trigger trg_fichas_tecnicas_updated before update on public.fichas_tecnicas
  for each row execute function public.set_updated_at();

-- ============================================================
-- FIN migración 043
-- ============================================================
