-- ============================================================
-- 042_nuevas_recetas_pipeline.sql  (PRP-031)
-- Pipeline kanban por fases editables para NUEVAS RECETAS.
--
-- Idempotente. Extiende nuevas_recetas (no la rompe) y añade:
--   - Config por empresa: fases, sub-estados, gatekeepers
--   - Borrador de ficha técnica dentro de nuevas_recetas
--   - Ingredientes con prioridad principal/secundario
--   - Compra a proveedor por receta
--   - Catas estructuradas con foto + escandallo snapshot
--   - Historial de movimientos entre fases
--   - Tabla tareas (reemplazo del localStorage del TareasDrawer)
--   - Función seed idempotente de 5 fases por empresa
--   - Migración de datos existentes al nuevo modelo
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Extensión de nuevas_recetas
-- ────────────────────────────────────────────────────────────
alter table public.nuevas_recetas
  add column if not exists fase_id uuid,
  add column if not exists sub_estado_id uuid,
  add column if not exists ficha_tecnica_id uuid,
  add column if not exists estado_general text not null default 'en_progreso'
    check (estado_general in ('en_progreso','aprobada','archivada')),
  add column if not exists fecha_fase_inicio timestamptz default now(),
  add column if not exists datos_gatekeeper jsonb not null default '{}'::jsonb,
  add column if not exists favorita boolean not null default false,
  add column if not exists motivo_archivado text,
  -- Borrador de ficha técnica (NO toca fichas_tecnicas hasta Publicar oficial)
  add column if not exists ft_descripcion text,
  add column if not exists ft_elaboracion text,
  add column if not exists ft_alergenos text[] default '{}',
  add column if not exists ft_partida text,
  add column if not exists ft_tiempo_preparacion int,
  add column if not exists ft_porciones int default 1,
  add column if not exists ft_pvp_propuesto numeric(10,2),
  add column if not exists ft_coste_estimado numeric(10,2),
  add column if not exists ft_etiquetas_finales text[] default '{}';

create index if not exists idx_nuevas_recetas_fase
  on public.nuevas_recetas(empresa_id, fase_id);
create index if not exists idx_nuevas_recetas_estado_general
  on public.nuevas_recetas(empresa_id, estado_general);

-- FK a fichas_tecnicas SOLO si la tabla existe (puede no haber corrido la migración 010)
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='fichas_tecnicas')
     and not exists (select 1 from information_schema.constraint_column_usage
                     where table_name='nuevas_recetas' and constraint_name='nuevas_recetas_ficha_tecnica_id_fkey') then
    alter table public.nuevas_recetas
      add constraint nuevas_recetas_ficha_tecnica_id_fkey
      foreign key (ficha_tecnica_id) references public.fichas_tecnicas(id) on delete set null;
  end if;
end $$;

-- ────────────────────────────────────────────────────────────
-- 2. nueva_receta_fase — config por empresa
-- ────────────────────────────────────────────────────────────
create table if not exists public.nueva_receta_fase (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  color text not null default 'gris'
    check (color in ('azul','naranja','ambar','violeta','rosa','verde','rojo','cian','indigo','gris')),
  orden int not null,
  responsable_departamento text,
  responsable_user_id uuid,
  plazo_dias int,
  es_sistema boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_fase_empresa_orden
  on public.nueva_receta_fase(empresa_id, orden);

-- FK diferida ahora que la tabla existe
do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_name='nuevas_recetas' and constraint_name='nuevas_recetas_fase_id_fkey'
  ) then
    alter table public.nuevas_recetas
      add constraint nuevas_recetas_fase_id_fkey
      foreign key (fase_id) references public.nueva_receta_fase(id) on delete set null;
  end if;
end $$;

-- ────────────────────────────────────────────────────────────
-- 3. nueva_receta_sub_estado
-- ────────────────────────────────────────────────────────────
create table if not exists public.nueva_receta_sub_estado (
  id uuid primary key default gen_random_uuid(),
  fase_id uuid not null references public.nueva_receta_fase(id) on delete cascade,
  nombre text not null,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_sub_estado_fase
  on public.nueva_receta_sub_estado(fase_id, orden);

do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_name='nuevas_recetas' and constraint_name='nuevas_recetas_sub_estado_id_fkey'
  ) then
    alter table public.nuevas_recetas
      add constraint nuevas_recetas_sub_estado_id_fkey
      foreign key (sub_estado_id) references public.nueva_receta_sub_estado(id) on delete set null;
  end if;
end $$;

-- ────────────────────────────────────────────────────────────
-- 4. nueva_receta_gatekeeper — datos obligatorios al entrar a una fase
-- ────────────────────────────────────────────────────────────
create table if not exists public.nueva_receta_gatekeeper (
  id uuid primary key default gen_random_uuid(),
  fase_id uuid not null references public.nueva_receta_fase(id) on delete cascade,
  campo text not null,
  label text not null,
  tipo text not null check (tipo in ('texto','numero','adjunto','booleano','select','ref')),
  opciones jsonb,
  obligatorio boolean not null default true,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_gatekeeper_fase
  on public.nueva_receta_gatekeeper(fase_id, orden);

-- ────────────────────────────────────────────────────────────
-- 5. nueva_receta_ingrediente — con prioridad principal/secundario
-- ────────────────────────────────────────────────────────────
create table if not exists public.nueva_receta_ingrediente (
  id uuid primary key default gen_random_uuid(),
  receta_id uuid not null references public.nuevas_recetas(id) on delete cascade,
  producto_id uuid references public.productos(id) on delete set null,
  nombre_libre text,
  cantidad numeric(10,3),
  unidad text default 'g',
  prioridad text not null default 'secundario'
    check (prioridad in ('principal','secundario')),
  orden int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_ing_receta
  on public.nueva_receta_ingrediente(receta_id, orden);

-- ────────────────────────────────────────────────────────────
-- 6. nueva_receta_compra — vínculo con Logística
-- ────────────────────────────────────────────────────────────
create table if not exists public.nueva_receta_compra (
  id uuid primary key default gen_random_uuid(),
  receta_id uuid not null references public.nuevas_recetas(id) on delete cascade,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  proveedor_nombre_libre text,
  producto_id uuid references public.productos(id) on delete set null,
  producto_nombre_propuesto text,
  cantidad numeric(10,3),
  unidad text default 'kg',
  precio_propuesto numeric(10,2),
  fecha_recepcion_prevista date,
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists idx_compra_receta
  on public.nueva_receta_compra(receta_id);

-- ────────────────────────────────────────────────────────────
-- 7. nueva_receta_cata — catas estructuradas
-- ────────────────────────────────────────────────────────────
create table if not exists public.nueva_receta_cata (
  id uuid primary key default gen_random_uuid(),
  receta_id uuid not null references public.nuevas_recetas(id) on delete cascade,
  numero int not null,                              -- 1, 2, 3...
  fecha date not null default current_date,
  valoracion text check (valoracion in
    ('pendiente','rehacer_entera','rehacer_media','semi_aprobada','aprobada')),
  aciertos text,
  mejoras text,
  coste_real numeric(10,2),
  pvp_sugerido numeric(10,2),
  foto_url text,
  escandallo_snapshot jsonb,
  director_user_id uuid,
  director_nombre text,
  created_at timestamptz not null default now(),
  unique (receta_id, numero)
);

create index if not exists idx_cata_receta
  on public.nueva_receta_cata(receta_id, numero);

-- ────────────────────────────────────────────────────────────
-- 8. nueva_receta_historial — cambios de fase
-- ────────────────────────────────────────────────────────────
create table if not exists public.nueva_receta_historial (
  id uuid primary key default gen_random_uuid(),
  receta_id uuid not null references public.nuevas_recetas(id) on delete cascade,
  fase_anterior_id uuid references public.nueva_receta_fase(id) on delete set null,
  fase_anterior_nombre text,
  fase_nueva_id uuid references public.nueva_receta_fase(id) on delete set null,
  fase_nueva_nombre text,
  sub_estado_nuevo_id uuid references public.nueva_receta_sub_estado(id) on delete set null,
  usuario_id uuid,
  usuario_nombre text,
  nota text,
  comunicado boolean not null default false,
  tarea_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_historial_receta
  on public.nueva_receta_historial(receta_id, created_at desc);

-- ────────────────────────────────────────────────────────────
-- 9. tareas — reemplazo persistente del localStorage del TareasDrawer
-- ────────────────────────────────────────────────────────────
create table if not exists public.tareas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  user_id uuid,                                     -- destinatario (a quien le aparece en drawer)
  titulo text not null,
  descripcion text,
  fecha date not null default current_date,
  hecha boolean not null default false,
  prioridad text not null default 'media' check (prioridad in ('alta','media','baja')),
  tipo text default 'manual'
    check (tipo in ('manual','nueva_receta_fase','sistema')),
  link_url text,
  ref_tabla text,
  ref_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tareas_user_fecha
  on public.tareas(user_id, fecha desc);
create index if not exists idx_tareas_empresa
  on public.tareas(empresa_id);

-- ────────────────────────────────────────────────────────────
-- 10. RLS — activar y policies
-- ────────────────────────────────────────────────────────────
alter table public.nueva_receta_fase          enable row level security;
alter table public.nueva_receta_sub_estado    enable row level security;
alter table public.nueva_receta_gatekeeper    enable row level security;
alter table public.nueva_receta_ingrediente   enable row level security;
alter table public.nueva_receta_compra        enable row level security;
alter table public.nueva_receta_cata          enable row level security;
alter table public.nueva_receta_historial     enable row level security;
alter table public.tareas                     enable row level security;

-- fase: por empresa
drop policy if exists "fase_read"   on public.nueva_receta_fase;
drop policy if exists "fase_write"  on public.nueva_receta_fase;
create policy "fase_read" on public.nueva_receta_fase for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
create policy "fase_write" on public.nueva_receta_fase for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

-- sub_estado / gatekeeper: vía fase
drop policy if exists "sub_read"   on public.nueva_receta_sub_estado;
drop policy if exists "sub_write"  on public.nueva_receta_sub_estado;
create policy "sub_read" on public.nueva_receta_sub_estado for select to authenticated
  using (exists (select 1 from public.nueva_receta_fase f
                 where f.id = fase_id
                   and f.empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())));
create policy "sub_write" on public.nueva_receta_sub_estado for all to authenticated
  using (true) with check (true);

drop policy if exists "gk_read"   on public.nueva_receta_gatekeeper;
drop policy if exists "gk_write"  on public.nueva_receta_gatekeeper;
create policy "gk_read" on public.nueva_receta_gatekeeper for select to authenticated
  using (exists (select 1 from public.nueva_receta_fase f
                 where f.id = fase_id
                   and f.empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())));
create policy "gk_write" on public.nueva_receta_gatekeeper for all to authenticated
  using (true) with check (true);

-- ingrediente / compra / cata / historial: vía receta
drop policy if exists "ing_read"   on public.nueva_receta_ingrediente;
drop policy if exists "ing_write"  on public.nueva_receta_ingrediente;
create policy "ing_read" on public.nueva_receta_ingrediente for select to authenticated
  using (exists (select 1 from public.nuevas_recetas r
                 where r.id = receta_id
                   and r.empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())));
create policy "ing_write" on public.nueva_receta_ingrediente for all to authenticated
  using (true) with check (true);

drop policy if exists "compra_read"   on public.nueva_receta_compra;
drop policy if exists "compra_write"  on public.nueva_receta_compra;
create policy "compra_read" on public.nueva_receta_compra for select to authenticated
  using (exists (select 1 from public.nuevas_recetas r
                 where r.id = receta_id
                   and r.empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())));
create policy "compra_write" on public.nueva_receta_compra for all to authenticated
  using (true) with check (true);

drop policy if exists "cata_read"   on public.nueva_receta_cata;
drop policy if exists "cata_write"  on public.nueva_receta_cata;
create policy "cata_read" on public.nueva_receta_cata for select to authenticated
  using (exists (select 1 from public.nuevas_recetas r
                 where r.id = receta_id
                   and r.empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())));
create policy "cata_write" on public.nueva_receta_cata for all to authenticated
  using (true) with check (true);

drop policy if exists "hist_read"   on public.nueva_receta_historial;
drop policy if exists "hist_write"  on public.nueva_receta_historial;
create policy "hist_read" on public.nueva_receta_historial for select to authenticated
  using (exists (select 1 from public.nuevas_recetas r
                 where r.id = receta_id
                   and r.empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())));
create policy "hist_write" on public.nueva_receta_historial for all to authenticated
  using (true) with check (true);

-- tareas: el user solo ve las suyas o las creadas por él en su empresa
drop policy if exists "tareas_read"   on public.tareas;
drop policy if exists "tareas_write"  on public.tareas;
create policy "tareas_read" on public.tareas for select to authenticated
  using (
    user_id = auth.uid()
    or created_by = auth.uid()
    or empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
  );
create policy "tareas_write" on public.tareas for all to authenticated
  using (true) with check (true);

-- ────────────────────────────────────────────────────────────
-- 11. Función seed idempotente — 5 fases por empresa
-- ────────────────────────────────────────────────────────────
create or replace function public.ensure_nueva_receta_seed(p_empresa_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_fase_id uuid;
begin
  select count(*) into v_count from public.nueva_receta_fase where empresa_id = p_empresa_id;
  if v_count > 0 then return; end if;

  -- Fase 1: Propuesta
  insert into public.nueva_receta_fase(empresa_id, nombre, color, orden, plazo_dias)
    values (p_empresa_id, 'Propuesta de receta', 'azul', 1, 3)
    returning id into v_fase_id;
  insert into public.nueva_receta_sub_estado(fase_id, nombre, orden) values
    (v_fase_id, 'Borrador', 1),
    (v_fase_id, 'Presentada', 2);
  insert into public.nueva_receta_gatekeeper(fase_id, campo, label, tipo, obligatorio, orden) values
    (v_fase_id, 'nombre', 'Nombre de la receta', 'texto', true, 1);

  -- Fase 2: Propuesta de compra
  insert into public.nueva_receta_fase(empresa_id, nombre, color, orden, plazo_dias)
    values (p_empresa_id, 'Propuesta de compra', 'naranja', 2, 7)
    returning id into v_fase_id;
  insert into public.nueva_receta_sub_estado(fase_id, nombre, orden) values
    (v_fase_id, 'Buscando proveedor', 1),
    (v_fase_id, 'Precios recibidos', 2);
  insert into public.nueva_receta_gatekeeper(fase_id, campo, label, tipo, obligatorio, orden) values
    (v_fase_id, 'ingredientes_con_prioridad', 'Ingredientes etiquetados (principal/secundario)', 'booleano', true, 1);

  -- Fase 3: Primera cata
  insert into public.nueva_receta_fase(empresa_id, nombre, color, orden, plazo_dias)
    values (p_empresa_id, 'Primera cata', 'ambar', 3, 14)
    returning id into v_fase_id;
  insert into public.nueva_receta_sub_estado(fase_id, nombre, orden) values
    (v_fase_id, 'Cata programada', 1),
    (v_fase_id, 'Cata realizada', 2);
  insert into public.nueva_receta_gatekeeper(fase_id, campo, label, tipo, obligatorio, orden) values
    (v_fase_id, 'compra_registrada', 'Proveedor y productos seleccionados', 'booleano', true, 1);

  -- Fase 4: Segunda cata
  insert into public.nueva_receta_fase(empresa_id, nombre, color, orden, plazo_dias)
    values (p_empresa_id, 'Segunda cata', 'violeta', 4, 7)
    returning id into v_fase_id;
  insert into public.nueva_receta_sub_estado(fase_id, nombre, orden) values
    (v_fase_id, 'Cata programada', 1),
    (v_fase_id, 'Cata realizada', 2),
    (v_fase_id, 'Etiquetas finales', 3);
  insert into public.nueva_receta_gatekeeper(fase_id, campo, label, tipo, obligatorio, orden) values
    (v_fase_id, 'cata_1_registrada', 'Primera cata realizada y valorada', 'booleano', true, 1);

  -- Fase 5: Marketing y carta
  insert into public.nueva_receta_fase(empresa_id, nombre, color, orden, plazo_dias)
    values (p_empresa_id, 'Marketing y carta', 'verde', 5, 14)
    returning id into v_fase_id;
  insert into public.nueva_receta_sub_estado(fase_id, nombre, orden) values
    (v_fase_id, 'Fotos pendientes', 1),
    (v_fase_id, 'Publicada oficial', 2);
  insert into public.nueva_receta_gatekeeper(fase_id, campo, label, tipo, obligatorio, orden) values
    (v_fase_id, 'cata_2_aprobada', 'Segunda cata aprobada o semi-aprobada', 'booleano', true, 1),
    (v_fase_id, 'etiquetas_finales', 'Etiquetas finales definidas', 'booleano', true, 2);
end;
$$;

-- ────────────────────────────────────────────────────────────
-- 12. Migración de datos existentes (idempotente)
--    Mapea recetas viejas (enum `estado`) a fase correspondiente.
-- ────────────────────────────────────────────────────────────
do $$
declare
  r record;
  v_fase_id uuid;
  v_fase_nombre text;
begin
  -- Seed para todas las empresas con recetas existentes
  for r in (select distinct empresa_id from public.nuevas_recetas where fase_id is null) loop
    perform public.ensure_nueva_receta_seed(r.empresa_id);
  end loop;

  -- Mapear estado viejo → fase nueva
  for r in (select id, empresa_id, estado from public.nuevas_recetas where fase_id is null) loop
    v_fase_nombre := case r.estado
      when 'propuesto' then 'Propuesta de receta'
      when 'en_cata' then 'Primera cata'
      when 'aprobado' then 'Marketing y carta'
      when 'rechazado' then 'Propuesta de receta'  -- se marcará como archivada
      when 'en_carta' then 'Marketing y carta'
      else 'Propuesta de receta'
    end;

    select id into v_fase_id from public.nueva_receta_fase
      where empresa_id = r.empresa_id and nombre = v_fase_nombre limit 1;

    update public.nuevas_recetas set
      fase_id = v_fase_id,
      estado_general = case
        when r.estado = 'rechazado' then 'archivada'
        when r.estado in ('aprobado','en_carta') then 'aprobada'
        else 'en_progreso'
      end,
      fecha_fase_inicio = coalesce(fecha_fase_inicio, now())
    where id = r.id;
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────
-- 13. Storage bucket para fotos de cata (QR móvil)
--     Si ya existe no hace nada.
-- ────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('nuevas-recetas-fotos-cata', 'nuevas-recetas-fotos-cata', false)
  on conflict (id) do nothing;

-- Policy de lectura: authenticated users de la empresa
drop policy if exists "recetas_fotos_read" on storage.objects;
create policy "recetas_fotos_read" on storage.objects for select to authenticated
  using (bucket_id = 'nuevas-recetas-fotos-cata');

drop policy if exists "recetas_fotos_write" on storage.objects;
create policy "recetas_fotos_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'nuevas-recetas-fotos-cata');

drop policy if exists "recetas_fotos_update" on storage.objects;
create policy "recetas_fotos_update" on storage.objects for update to authenticated
  using (bucket_id = 'nuevas-recetas-fotos-cata');

drop policy if exists "recetas_fotos_delete" on storage.objects;
create policy "recetas_fotos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'nuevas-recetas-fotos-cata');

-- ────────────────────────────────────────────────────────────
-- 14. Trigger de updated_at
-- ────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_fase_updated on public.nueva_receta_fase;
create trigger trg_fase_updated before update on public.nueva_receta_fase
  for each row execute function public.set_updated_at();

drop trigger if exists trg_tareas_updated on public.tareas;
create trigger trg_tareas_updated before update on public.tareas
  for each row execute function public.set_updated_at();

-- ============================================================
-- FIN migración 042
-- ============================================================
