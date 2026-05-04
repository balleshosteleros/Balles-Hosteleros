-- ============================================================
-- 046_fichas_config.sql
-- Configuración persistente del módulo Fichas Técnicas / Ajustes.
--
-- Modelo normalizado:
--   fichas_config_grupos (catálogo global: categorias, alergenos, …)
--   fichas_config_items  (valores por empresa para cada grupo)
--
-- Aditivo: NO toca fichas_tecnicas ni nuevas_recetas.
-- Idempotente: seguro de re-ejecutar.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Catálogo de grupos (global, no por empresa)
-- ────────────────────────────────────────────────────────────
create table if not exists public.fichas_config_grupos (
  codigo text primary key,
  nombre text not null,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.fichas_config_grupos (codigo, nombre, orden) values
  ('categorias',      'Categorías',      1),
  ('alergenos',       'Alérgenos',       2),
  ('partidas',        'Partidas',        3),
  ('menaje',          'Menaje',          4),
  ('recomendaciones', 'Recomendaciones', 5)
on conflict (codigo) do nothing;

-- ────────────────────────────────────────────────────────────
-- 2. Items por empresa
-- ────────────────────────────────────────────────────────────
create table if not exists public.fichas_config_items (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  grupo_codigo text not null references public.fichas_config_grupos(codigo) on delete cascade,
  nombre text not null,
  descripcion text,
  orden integer not null default 0,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create unique index if not exists uniq_fci_empresa_grupo_nombre
  on public.fichas_config_items (empresa_id, grupo_codigo, lower(nombre));

create index if not exists idx_fci_empresa_grupo
  on public.fichas_config_items (empresa_id, grupo_codigo, orden);

-- ────────────────────────────────────────────────────────────
-- 3. RLS
-- ────────────────────────────────────────────────────────────
alter table public.fichas_config_grupos enable row level security;
alter table public.fichas_config_items  enable row level security;

-- Grupos: lectura libre para autenticados (catálogo global).
drop policy if exists "fcg_read"  on public.fichas_config_grupos;
create policy "fcg_read" on public.fichas_config_grupos for select to authenticated
  using (true);

-- Items: solo de la empresa del usuario.
drop policy if exists "fci_read"  on public.fichas_config_items;
drop policy if exists "fci_write" on public.fichas_config_items;
create policy "fci_read" on public.fichas_config_items for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
create policy "fci_write" on public.fichas_config_items for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

-- ────────────────────────────────────────────────────────────
-- 4. Trigger updated_at
-- ────────────────────────────────────────────────────────────
drop trigger if exists trg_fci_updated on public.fichas_config_items;
create trigger trg_fci_updated before update on public.fichas_config_items
  for each row execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- 5. Seed por empresa (defaults de DEFAULT_* del front)
--    Solo inserta lo que falte; respeta el UNIQUE.
-- ────────────────────────────────────────────────────────────
do $$
declare
  emp record;
  v_categorias text[] := array[
    'PARA EMPEZAR','ARROCES','PARA VEGANOS','DE LA MAR','DE LA TIERRA',
    'MOMENTOS DULCES','PARA NIÑOS'
  ];
  v_alergenos text[] := array[
    'Ninguno','Gluten','Crustáceos','Huevos','Pescado','Cacahuetes','Soja',
    'Lácteos','Frutos con cáscara','Apio','Mostaza','Sésamo','Sulfitos',
    'Altramuces','Moluscos'
  ];
  v_partidas text[] := array[
    'Entrantes fríos/calientes','Arroces','Entrantes veganos',
    'Pescados principales','Carnes principales','Postres','Menú infantil',
    'Pescados entrante','Mariscos y pescados','Platos veganos','Carnes'
  ];
  v_menaje text[] := array[
    'Plato rectangular de pizarra','Cazuela de barro individual',
    'Bowl de cerámica artesanal','Fuente ovalada de cerámica blanca',
    'Plato llano de porcelana','Plato hondo individual de porcelana',
    'Bandeja infantil de madera','Paellera individual',
    'Tabla de madera de olivo','Tabla de corte con canaleta',
    'Plato de postre con cuchara','Cesta de mimbre con papel',
    'Bowl de bambú','Aro de presentación en plato llano'
  ];
  v_recos text[] := array[
    'Ninguno','Picante','Para niños','Veganos','Platos Estrella',
    'Comer con las manos','Comidas','Cenas'
  ];
  i int;
begin
  for emp in select id from public.empresas loop
    -- categorias
    for i in 1 .. array_length(v_categorias, 1) loop
      insert into public.fichas_config_items (empresa_id, grupo_codigo, nombre, orden)
      values (emp.id, 'categorias', v_categorias[i], i)
      on conflict (empresa_id, grupo_codigo, lower(nombre)) do nothing;
    end loop;

    for i in 1 .. array_length(v_alergenos, 1) loop
      insert into public.fichas_config_items (empresa_id, grupo_codigo, nombre, orden)
      values (emp.id, 'alergenos', v_alergenos[i], i)
      on conflict (empresa_id, grupo_codigo, lower(nombre)) do nothing;
    end loop;

    for i in 1 .. array_length(v_partidas, 1) loop
      insert into public.fichas_config_items (empresa_id, grupo_codigo, nombre, orden)
      values (emp.id, 'partidas', v_partidas[i], i)
      on conflict (empresa_id, grupo_codigo, lower(nombre)) do nothing;
    end loop;

    for i in 1 .. array_length(v_menaje, 1) loop
      insert into public.fichas_config_items (empresa_id, grupo_codigo, nombre, orden)
      values (emp.id, 'menaje', v_menaje[i], i)
      on conflict (empresa_id, grupo_codigo, lower(nombre)) do nothing;
    end loop;

    for i in 1 .. array_length(v_recos, 1) loop
      insert into public.fichas_config_items (empresa_id, grupo_codigo, nombre, orden)
      values (emp.id, 'recomendaciones', v_recos[i], i)
      on conflict (empresa_id, grupo_codigo, lower(nombre)) do nothing;
    end loop;
  end loop;
end $$;

-- ============================================================
-- FIN migración 046
-- ============================================================
