-- Renombrado: "zona publica" -> "grupo de zonas".
--
-- El nombre anterior describia DONDE se ve (el portal publico); el nuevo
-- describe QUE ES (una agrupacion de zonas internas). Es ademas como se llama
-- en la interfaz y en el lenguaje del negocio.
--
--   zonas_publicas               -> grupos_zonas
--   zona_publica_zonas           -> grupo_zona_zonas
--   reservas.zona_publica_id     -> reservas.grupo_zona_id
--
-- Idempotente: cada paso comprueba que no se haya hecho ya.

do $$
begin
  if to_regclass('public.zonas_publicas') is not null
     and to_regclass('public.grupos_zonas') is null then
    alter table public.zonas_publicas rename to grupos_zonas;
  end if;

  if to_regclass('public.zona_publica_zonas') is not null
     and to_regclass('public.grupo_zona_zonas') is null then
    alter table public.zona_publica_zonas rename to grupo_zona_zonas;
  end if;
end $$;

-- Columna de enlace dentro de la tabla puente.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='grupo_zona_zonas'
      and column_name='zona_publica_id'
  ) then
    alter table public.grupo_zona_zonas rename column zona_publica_id to grupo_zona_id;
  end if;
end $$;

-- Columna en reservas.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='reservas'
      and column_name='zona_publica_id'
  ) then
    alter table public.reservas rename column zona_publica_id to grupo_zona_id;
  end if;
end $$;

-- Indices y restricciones, para que el nombre no delate el pasado.
alter index if exists zonas_publicas_local_nombre_uidx rename to grupos_zonas_local_nombre_uidx;
alter index if exists zonas_publicas_local_id_idx       rename to grupos_zonas_local_id_idx;
alter index if exists zona_publica_zonas_zona_uidx      rename to grupo_zona_zonas_zona_uidx;
alter index if exists zona_publica_zonas_publica_idx    rename to grupo_zona_zonas_grupo_idx;
alter index if exists reservas_zona_publica_id_idx      rename to reservas_grupo_zona_id_idx;

comment on table public.grupos_zonas is
  'Grupos de zonas: agrupan zonas internas bajo el nombre que ve el cliente al reservar.';
comment on column public.reservas.grupo_zona_id is
  'Grupo de zonas que eligio el cliente (lo unico que el conoce). El correo lee su nombre ACTUAL. Para el staff manda `zona`.';

-- Las politicas RLS referencian el nombre viejo en su cuerpo: se recrean.
alter table public.grupos_zonas enable row level security;
alter table public.grupo_zona_zonas enable row level security;

drop policy if exists zonas_publicas_rw on public.grupos_zonas;
drop policy if exists grupos_zonas_rw on public.grupos_zonas;
create policy grupos_zonas_rw on public.grupos_zonas
  for all
  using (
    exists (
      select 1 from public.locales l
      where l.id = grupos_zonas.local_id
        and l.empresa_id in (select empresas_del_usuario())
    )
  )
  with check (
    exists (
      select 1 from public.locales l
      where l.id = grupos_zonas.local_id
        and l.empresa_id in (select empresas_del_usuario())
    )
  );

drop policy if exists zona_publica_zonas_rw on public.grupo_zona_zonas;
drop policy if exists grupo_zona_zonas_rw on public.grupo_zona_zonas;
create policy grupo_zona_zonas_rw on public.grupo_zona_zonas
  for all
  using (
    exists (
      select 1
      from public.grupos_zonas g
      join public.locales l on l.id = g.local_id
      where g.id = grupo_zona_zonas.grupo_zona_id
        and l.empresa_id in (select empresas_del_usuario())
    )
  )
  with check (
    exists (
      select 1
      from public.grupos_zonas g
      join public.locales l on l.id = g.local_id
      where g.id = grupo_zona_zonas.grupo_zona_id
        and l.empresa_id in (select empresas_del_usuario())
    )
  );
