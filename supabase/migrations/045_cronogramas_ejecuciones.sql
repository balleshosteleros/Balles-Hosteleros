-- ============================================================
-- 045_cronogramas_ejecuciones.sql  (PRP-032)
-- Cronogramas: ejecuciones diarias por empleado + dashboard
-- productividad.
--
-- Idempotente. Extiende cronogramas_operativos con campos de
-- calendario (día semana / mes / anual), crea la tabla de
-- ejecuciones por usuario y la RPC de siembra lazy.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0. Extensión de profiles: departamento
--    Necesario para linkear empleado ↔ cronograma.rol
-- ────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists departamento text;

create index if not exists idx_profiles_departamento
  on public.profiles(empresa_id, departamento);

-- ────────────────────────────────────────────────────────────
-- 1. Extensión de cronogramas_operativos
-- ────────────────────────────────────────────────────────────
alter table public.cronogramas_operativos
  add column if not exists empresa_id uuid references public.empresas(id) on delete cascade,
  add column if not exists dia_semana int[] default null,
  add column if not exists dia_mes int default null
    check (dia_mes is null or (dia_mes between 1 and 31)),
  add column if not exists fecha_anual text default null
    check (fecha_anual is null or fecha_anual ~ '^[0-1][0-9]-[0-3][0-9]$'),
  add column if not exists meses_trimestrales int[] default array[1,4,7,10]::int[],
  add column if not exists empleados_asignados uuid[] default null;

create index if not exists idx_cronogramas_empresa
  on public.cronogramas_operativos(empresa_id);
create index if not exists idx_cronogramas_empresa_rol
  on public.cronogramas_operativos(empresa_id, rol);

-- ────────────────────────────────────────────────────────────
-- 2. Tabla cronograma_ejecuciones
-- ────────────────────────────────────────────────────────────
create table if not exists public.cronograma_ejecuciones (
  id                uuid primary key default gen_random_uuid(),
  tarea_id          uuid not null references public.cronogramas_operativos(id) on delete cascade,
  empresa_id        uuid references public.empresas(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  fecha_programada  date not null,
  estado            text not null default 'pendiente'
    check (estado in ('pendiente','hecha','omitida')),
  confirmada_en     timestamptz,
  nota              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (tarea_id, user_id, fecha_programada)
);

create index if not exists idx_ejec_user_fecha
  on public.cronograma_ejecuciones(user_id, fecha_programada);
create index if not exists idx_ejec_empresa_fecha
  on public.cronograma_ejecuciones(empresa_id, fecha_programada);
create index if not exists idx_ejec_tarea
  on public.cronograma_ejecuciones(tarea_id);
create index if not exists idx_ejec_estado
  on public.cronograma_ejecuciones(empresa_id, estado, fecha_programada);

-- ────────────────────────────────────────────────────────────
-- 3. Trigger updated_at
-- ────────────────────────────────────────────────────────────
create or replace function public.cronograma_ejec_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_cronograma_ejec_updated_at on public.cronograma_ejecuciones;
create trigger trg_cronograma_ejec_updated_at
  before update on public.cronograma_ejecuciones
  for each row execute function public.cronograma_ejec_set_updated_at();

-- ────────────────────────────────────────────────────────────
-- 4. RLS cronograma_ejecuciones
-- ────────────────────────────────────────────────────────────
alter table public.cronograma_ejecuciones enable row level security;

-- SELECT: el empleado ve las suyas; admin ve las de su empresa
drop policy if exists ejec_select_own_or_admin on public.cronograma_ejecuciones;
create policy ejec_select_own_or_admin on public.cronograma_ejecuciones
  for select using (
    user_id = auth.uid()
    or empresa_id in (
      select p.empresa_id from public.profiles p
      where p.user_id = auth.uid() and lower(p.role) in ('admin','director')
    )
  );

-- INSERT: solo el propio usuario puede crear sus ejecuciones
drop policy if exists ejec_insert_own on public.cronograma_ejecuciones;
create policy ejec_insert_own on public.cronograma_ejecuciones
  for insert with check (
    user_id = auth.uid()
  );

-- UPDATE: el empleado confirma las suyas; admin puede corregir
drop policy if exists ejec_update_own_or_admin on public.cronograma_ejecuciones;
create policy ejec_update_own_or_admin on public.cronograma_ejecuciones
  for update using (
    user_id = auth.uid()
    or empresa_id in (
      select p.empresa_id from public.profiles p
      where p.user_id = auth.uid() and lower(p.role) in ('admin','director')
    )
  );

-- DELETE: solo admin puede borrar ejecuciones
drop policy if exists ejec_delete_admin on public.cronograma_ejecuciones;
create policy ejec_delete_admin on public.cronograma_ejecuciones
  for delete using (
    empresa_id in (
      select p.empresa_id from public.profiles p
      where p.user_id = auth.uid() and lower(p.role) in ('admin','director')
    )
  );

-- ────────────────────────────────────────────────────────────
-- 5. RPC: seed_cronograma_ejecuciones (idempotente)
--    Siembra las ejecuciones del rango [fecha_desde, fecha_hasta]
--    para el usuario autenticado, basándose en su rol y las tareas
--    aplicables según frecuencia.
-- ────────────────────────────────────────────────────────────
create or replace function public.seed_cronograma_ejecuciones(
  p_fecha_desde date default current_date,
  p_fecha_hasta date default current_date
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id          uuid := auth.uid();
  v_empresa_id       uuid;
  v_departamento     text;
  v_inserted         int := 0;
  v_fecha            date;
  v_dow_iso          int;
  v_day              int;
  v_month            int;
  v_ultimo_dia       int;
  r                  record;
begin
  if v_user_id is null then
    return 0;
  end if;

  select p.empresa_id, coalesce(p.departamento, '')
    into v_empresa_id, v_departamento
  from public.profiles p
  where p.user_id = v_user_id
  limit 1;

  if v_empresa_id is null then
    return 0;
  end if;

  v_fecha := p_fecha_desde;
  while v_fecha <= p_fecha_hasta loop
    v_dow_iso    := extract(isodow from v_fecha)::int;
    v_day        := extract(day    from v_fecha)::int;
    v_month      := extract(month  from v_fecha)::int;
    v_ultimo_dia := extract(day from (date_trunc('month', v_fecha) + interval '1 month - 1 day'))::int;

    for r in
      select c.id, c.frecuencia, c.dia_semana, c.dia_mes, c.fecha_anual,
             c.meses_trimestrales, c.empleados_asignados
      from public.cronogramas_operativos c
      where (c.empresa_id = v_empresa_id or c.empresa_id is null)
        and c.parent_id is null
        and (
          -- A: asignación explícita gana sobre todo
          (c.empleados_asignados is not null and v_user_id = any(c.empleados_asignados))
          -- B: por departamento si el usuario lo tiene configurado
          or (c.empleados_asignados is null and v_departamento <> '' and c.rol = v_departamento)
        )
    loop
      -- ¿aplica la tarea en v_fecha según su frecuencia?
      if
        (r.frecuencia = 'DIARIO') or
        (r.frecuencia = 'SEMANAL' and r.dia_semana is not null and v_dow_iso = any(r.dia_semana)) or
        (r.frecuencia = 'MENSUAL' and r.dia_mes is not null and
           (v_day = r.dia_mes or (r.dia_mes > v_ultimo_dia and v_day = v_ultimo_dia))) or
        (r.frecuencia = 'TRIMESTRAL' and r.dia_mes is not null and
           v_month = any(coalesce(r.meses_trimestrales, array[1,4,7,10]::int[])) and
           (v_day = r.dia_mes or (r.dia_mes > v_ultimo_dia and v_day = v_ultimo_dia))) or
        (r.frecuencia = 'ANUAL' and r.fecha_anual is not null and
           to_char(v_fecha, 'MM-DD') = r.fecha_anual)
        -- 'POR NECESIDAD' y 'OTRO' nunca se siembran automáticamente
      then
        insert into public.cronograma_ejecuciones(
          tarea_id, empresa_id, user_id, fecha_programada, estado
        )
        values (r.id, v_empresa_id, v_user_id, v_fecha, 'pendiente')
        on conflict (tarea_id, user_id, fecha_programada) do nothing;

        if found then
          v_inserted := v_inserted + 1;
        end if;
      end if;
    end loop;

    v_fecha := v_fecha + 1;
  end loop;

  return v_inserted;
end;
$$;

grant execute on function public.seed_cronograma_ejecuciones(date, date) to authenticated;

-- ────────────────────────────────────────────────────────────
-- 6. Vista agregada para dashboard productividad
-- ────────────────────────────────────────────────────────────
create or replace view public.v_cronograma_productividad as
select
  e.empresa_id,
  c.rol as departamento,
  e.user_id,
  e.fecha_programada,
  count(*)                              as total,
  count(*) filter (where e.estado = 'hecha')      as hechas,
  count(*) filter (where e.estado = 'pendiente')  as pendientes,
  count(*) filter (where e.estado = 'omitida')    as omitidas,
  round(
    100.0 * count(*) filter (where e.estado = 'hecha') / nullif(count(*), 0),
    1
  ) as pct_cumplimiento
from public.cronograma_ejecuciones e
join public.cronogramas_operativos c on c.id = e.tarea_id
group by e.empresa_id, c.rol, e.user_id, e.fecha_programada;

comment on view public.v_cronograma_productividad is
  'Agregado de ejecuciones por empresa/departamento/empleado/día para dashboards.';

comment on table public.cronograma_ejecuciones is
  'Ejecuciones diarias de tareas de cronograma por empleado. Una fila por (tarea, user, fecha).';
