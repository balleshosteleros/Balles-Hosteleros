-- =============================================================================
-- Festivos oficiales por empresa (nacionales + autonómicos + locales)
-- =============================================================================
-- Cada empresa tiene 14 festivos al año en España:
--   · ~10 nacionales (fijos + móviles según la Semana Santa)
--   · hasta 4 autonómicos, según la Comunidad Autónoma configurada
--   · 2 locales, que cada empresa configura a mano (dependen del municipio)
--
-- Los nacionales y autonómicos se GENERAN automáticamente a partir de la
-- comunidad autónoma de la empresa (`empresas.config_operativa.comunidadAutonoma`).
-- Los locales se preservan entre regeneraciones (nunca se borran automáticamente).
--
-- Auto-generación: un cron pg_cron dispara cada 1 de julio (ecuador del año, el
-- momento acordado) la creación de los festivos del AÑO SIGUIENTE para todas las
-- empresas.
--
-- Todo el script es IDEMPOTENTE: re-ejecutarlo no duplica ni rompe nada.
-- =============================================================================

-- --- 1. Tabla de festivos --------------------------------------------------
create table if not exists public.festivos (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  anio         int  not null,
  fecha        date not null,
  nombre       text not null,
  ambito       text not null check (ambito in ('nacional', 'autonomico', 'local')),
  -- 'auto' = generado por el sistema (regenerable); 'manual' = puesto por el
  -- usuario (festivos locales), no se borra al regenerar.
  origen       text not null default 'auto' check (origen in ('auto', 'manual')),
  creado_en    timestamptz not null default now(),
  -- Un festivo por empresa/fecha: dos ámbitos no pueden caer el mismo día.
  unique (empresa_id, fecha)
);

comment on table public.festivos is
  'Festivos oficiales por empresa y año (nacionales/autonómicos/locales). Los de origen=auto se regeneran desde la comunidad autónoma de la empresa; los origen=manual (locales) los mantiene el usuario.';

create index if not exists idx_festivos_empresa_anio on public.festivos (empresa_id, anio);

-- --- RLS -------------------------------------------------------------------
alter table public.festivos enable row level security;

drop policy if exists festivos_select on public.festivos;
create policy festivos_select on public.festivos
  for select using (empresa_id in (select public.empresas_del_usuario()));

drop policy if exists festivos_insert on public.festivos;
create policy festivos_insert on public.festivos
  for insert with check (empresa_id in (select public.empresas_del_usuario()));

drop policy if exists festivos_update on public.festivos;
create policy festivos_update on public.festivos
  for update using (empresa_id in (select public.empresas_del_usuario()))
  with check (empresa_id in (select public.empresas_del_usuario()));

drop policy if exists festivos_delete on public.festivos;
create policy festivos_delete on public.festivos
  for delete using (empresa_id in (select public.empresas_del_usuario()));


-- --- 2. Domingo de Pascua (Gauss/Butcher) — base de la Semana Santa móvil ---
create or replace function public.pascua_domingo(p_anio int)
returns date language plpgsql immutable as $$
declare
  a int; b int; c int; d int; e int; f int; g int; h int;
  i int; k int; l int; m int; mes int; dia int;
begin
  a := p_anio % 19; b := p_anio / 100; c := p_anio % 100;
  d := b / 4; e := b % 4; f := (b + 8) / 25; g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30; i := c / 4; k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7; m := (a + 11 * h + 22 * l) / 451;
  mes := (h + l - 7 * m + 114) / 31; dia := ((h + l - 7 * m + 114) % 31) + 1;
  return make_date(p_anio, mes, dia);
end; $$;


-- --- 3. Festivos NACIONALES de un año --------------------------------------
create or replace function public.festivos_nacionales(p_anio int)
returns table (fecha date, nombre text) language plpgsql immutable as $$
declare pascua date := public.pascua_domingo(p_anio);
begin
  return query select * from (values
    (make_date(p_anio, 1, 1),   'Año Nuevo'),
    (make_date(p_anio, 1, 6),   'Epifanía del Señor'),
    (pascua - 2,                'Viernes Santo'),
    (make_date(p_anio, 5, 1),   'Fiesta del Trabajo'),
    (make_date(p_anio, 8, 15),  'Asunción de la Virgen'),
    (make_date(p_anio, 10, 12), 'Fiesta Nacional de España'),
    (make_date(p_anio, 11, 1),  'Todos los Santos'),
    (make_date(p_anio, 12, 6),  'Día de la Constitución'),
    (make_date(p_anio, 12, 8),  'Inmaculada Concepción'),
    (make_date(p_anio, 12, 25), 'Navidad')
  ) as v(fecha, nombre);
end; $$;


-- --- 4. Festivos AUTONÓMICOS de un año, por Comunidad Autónoma --------------
-- Tabla plana de festivos propios de cada una de las 19 CCAA/ciudades autónomas,
-- filtrada por la comunidad recibida. Los móviles se derivan de la Pascua.
-- Aproximación del patrón estable de cada CCAA; puede requerir ajuste puntual
-- por decretos anuales, pero cubre el calendario habitual.
create or replace function public.festivos_autonomicos(p_anio int, p_comunidad text)
returns table (fecha date, nombre text) language plpgsql immutable as $$
declare
  pascua date := public.pascua_domingo(p_anio);
  jueves_santo date := pascua - 3;
  lunes_pascua date := pascua + 1;
  com text := lower(coalesce(p_comunidad, ''));
begin
  -- Sin comunidad configurada: solo Jueves Santo (festivo autonómico casi
  -- universal en España), para no dejar el calendario incompleto.
  if com = '' then
    return query select jueves_santo, 'Jueves Santo'::text;
    return;
  end if;

  return query
  select f.fecha, f.nombre from (values
    ('andalucía',            make_date(p_anio, 2, 28), 'Día de Andalucía'),
    ('andalucía',            jueves_santo,             'Jueves Santo'),
    ('aragón',               make_date(p_anio, 4, 23), 'Día de Aragón (San Jorge)'),
    ('aragón',               jueves_santo,             'Jueves Santo'),
    ('asturias',             make_date(p_anio, 9, 8),  'Día de Asturias'),
    ('asturias',             jueves_santo,             'Jueves Santo'),
    ('baleares',             make_date(p_anio, 3, 1),  'Día de las Islas Baleares'),
    ('baleares',             jueves_santo,             'Jueves Santo'),
    ('canarias',             make_date(p_anio, 5, 30), 'Día de Canarias'),
    ('canarias',             jueves_santo,             'Jueves Santo'),
    ('cantabria',            make_date(p_anio, 7, 28), 'Día de las Instituciones de Cantabria'),
    ('cantabria',            make_date(p_anio, 9, 15), 'La Bien Aparecida'),
    ('cantabria',            jueves_santo,             'Jueves Santo'),
    ('castilla-la mancha',   make_date(p_anio, 5, 31), 'Día de Castilla-La Mancha'),
    ('castilla-la mancha',   jueves_santo,             'Jueves Santo'),
    ('castilla y león',      make_date(p_anio, 4, 23), 'Día de Castilla y León'),
    ('castilla y león',      jueves_santo,             'Jueves Santo'),
    ('cataluña',             lunes_pascua,             'Lunes de Pascua'),
    ('cataluña',             make_date(p_anio, 6, 24), 'San Juan'),
    ('cataluña',             make_date(p_anio, 9, 11), 'Diada de Cataluña'),
    ('cataluña',             make_date(p_anio, 12, 26),'San Esteban'),
    ('comunidad valenciana', make_date(p_anio, 3, 19), 'San José'),
    ('comunidad valenciana', lunes_pascua,             'Lunes de Pascua'),
    ('comunidad valenciana', make_date(p_anio, 6, 24), 'San Juan'),
    ('comunidad valenciana', make_date(p_anio, 10, 9), 'Día de la Comunidad Valenciana'),
    ('extremadura',          make_date(p_anio, 9, 8),  'Día de Extremadura'),
    ('extremadura',          jueves_santo,             'Jueves Santo'),
    ('galicia',              jueves_santo,             'Jueves Santo'),
    ('galicia',              make_date(p_anio, 5, 17), 'Día das Letras Galegas'),
    ('galicia',              make_date(p_anio, 7, 25), 'Día Nacional de Galicia (Santiago)'),
    ('la rioja',             make_date(p_anio, 6, 9),  'Día de La Rioja'),
    ('la rioja',             jueves_santo,             'Jueves Santo'),
    ('madrid',               jueves_santo,             'Jueves Santo'),
    ('madrid',               make_date(p_anio, 5, 2),  'Día de la Comunidad de Madrid'),
    ('murcia',               make_date(p_anio, 3, 19), 'San José'),
    ('murcia',               jueves_santo,             'Jueves Santo'),
    ('murcia',               make_date(p_anio, 6, 9),  'Día de la Región de Murcia'),
    ('navarra',              jueves_santo,             'Jueves Santo'),
    ('navarra',              lunes_pascua,             'Lunes de Pascua'),
    ('país vasco',           jueves_santo,             'Jueves Santo'),
    ('país vasco',           lunes_pascua,             'Lunes de Pascua'),
    ('país vasco',           make_date(p_anio, 7, 25), 'Santiago Apóstol'),
    ('ceuta',                jueves_santo,             'Jueves Santo'),
    ('ceuta',                make_date(p_anio, 8, 5),  'Nuestra Señora de África'),
    ('ceuta',                make_date(p_anio, 9, 2),  'Día de Ceuta'),
    ('melilla',              jueves_santo,             'Jueves Santo'),
    ('melilla',              make_date(p_anio, 9, 8),  'Día de Melilla')
  ) as f(comunidad, fecha, nombre)
  where f.comunidad = com;
end; $$;


-- --- 5. Generar festivos auto de UNA empresa/año (preserva locales manuales) -
create or replace function public.generar_festivos_empresa(p_empresa uuid, p_anio int)
returns int language plpgsql security definer set search_path = public as $$
declare v_comunidad text;
begin
  select nullif(trim(coalesce(config_operativa->>'comunidadAutonoma', '')), '')
    into v_comunidad from public.empresas where id = p_empresa;

  -- Borra solo lo autogenerado de ese año; conserva los locales manuales.
  delete from public.festivos
  where empresa_id = p_empresa and anio = p_anio and origen = 'auto';

  -- Nacionales.
  insert into public.festivos (empresa_id, anio, fecha, nombre, ambito, origen)
  select p_empresa, p_anio, n.fecha, n.nombre, 'nacional', 'auto'
  from public.festivos_nacionales(p_anio) n
  where not exists (
    select 1 from public.festivos f where f.empresa_id = p_empresa and f.fecha = n.fecha);

  -- Autonómicos (según la CCAA de la empresa).
  insert into public.festivos (empresa_id, anio, fecha, nombre, ambito, origen)
  select p_empresa, p_anio, a.fecha, a.nombre, 'autonomico', 'auto'
  from public.festivos_autonomicos(p_anio, v_comunidad) a
  where not exists (
    select 1 from public.festivos f where f.empresa_id = p_empresa and f.fecha = a.fecha);

  return (select count(*) from public.festivos where empresa_id = p_empresa and anio = p_anio);
end; $$;


-- --- 6. Generar festivos de TODAS las empresas para un año -----------------
create or replace function public.generar_festivos_todas_empresas(p_anio int)
returns int language plpgsql security definer set search_path = public as $$
declare r record; v_empresas int := 0;
begin
  for r in select id from public.empresas loop
    perform public.generar_festivos_empresa(r.id, p_anio);
    v_empresas := v_empresas + 1;
  end loop;
  return v_empresas;
end; $$;


-- --- 7. Cron: cada 1 de julio, generar el AÑO SIGUIENTE ---------------------
-- pg_cron ya está instalado. 1 de julio a las 03:00 UTC.
do $$
begin
  perform cron.unschedule('generar_festivos_anio_siguiente')
  where exists (select 1 from cron.job where jobname = 'generar_festivos_anio_siguiente');
exception when others then null;
end $$;

select cron.schedule(
  'generar_festivos_anio_siguiente',
  '0 3 1 7 *',  -- min hora díames mes díasemana → 1 de julio, 03:00 UTC
  $cron$ select public.generar_festivos_todas_empresas((extract(year from now())::int) + 1) $cron$
);


-- --- 8. Seed inicial: año actual y siguiente para todas las empresas --------
select public.generar_festivos_todas_empresas(extract(year from now())::int);
select public.generar_festivos_todas_empresas(extract(year from now())::int + 1);
