-- ============================================================
-- 20260910170000_correo_auditoria_ranking.sql
-- Auditoría de correos (PRP-094) — Fase 3: los números del panel.
--
-- POR QUÉ SE CALCULA AQUÍ Y NO EN LA APLICACIÓN
--   El ranking agrupa miles de correos por interlocutor. Bajarlos al navegador
--   para contarlos allí sería lento, y además Supabase corta las lecturas en
--   1.000 filas: el panel enseñaría un ranking incompleto sin dar ningún aviso,
--   que es la peor forma de equivocarse. Agregado en la base, la respuesta es
--   una tabla ya hecha de unas decenas de filas.
--
-- SEGURIDAD
--   Ambas funciones son `security invoker`: se ejecutan con los permisos de
--   quien pregunta, así que la RLS de `correo_mensajes` sigue mandando y nadie
--   ve el correo de una empresa que no es la suya.
--
-- CERO IA: aquí solo se cuenta y se ordena.
-- ============================================================

-- ── 1. Con quién habla el buzón (la regla del 80/20) ────────────────────────
-- Devuelve los interlocutores ordenados de más a menos correos, con el
-- porcentaje que representa cada uno y el ACUMULADO. Ese acumulado es lo que
-- permite ver dónde se cruza el 80 %: todo lo que queda por encima de esa línea
-- es el puñado de contactos que genera la mayor parte del trabajo.
create or replace function public.correo_ranking_contactos(
  p_desde date,
  p_hasta date,
  p_buzon_ids uuid[] default null,
  -- Agrupa por dominio (la empresa entera) en vez de por dirección (la persona).
  p_por_dominio boolean default false,
  -- Los boletines y los `no-reply` no son trabajo: se pueden apagar.
  p_incluir_automaticos boolean default true,
  p_limite integer default 100
)
returns table (
  contacto    text,
  nombre      text,
  entrantes   bigint,
  salientes   bigint,
  total       bigint,
  porcentaje  numeric,
  acumulado   numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with filtrado as (
    select
      case when p_por_dominio then m.contraparte_dominio else m.contraparte_email end as clave,
      m.contraparte_nombre,
      m.direccion,
      m.enviado_at
    from public.correo_mensajes m
    where m.dia_empresa between p_desde and p_hasta
      and (p_buzon_ids is null or m.buzon_id = any(p_buzon_ids))
      and (p_incluir_automaticos or not m.automatico)
      -- Sin dirección no hay con quién: son correos con la cabecera ilegible.
      and coalesce(nullif(
        case when p_por_dominio then m.contraparte_dominio else m.contraparte_email end,
      ''), '') <> ''
  ),
  agrupado as (
    select
      clave as contacto,
      -- El nombre visible más reciente que se haya visto de ese contacto: la
      -- gente cambia la firma y queremos enseñar la última, no la primera.
      (array_agg(contraparte_nombre order by enviado_at desc)
         filter (where contraparte_nombre <> ''))[1] as nombre,
      count(*) filter (where direccion = 'entrante') as entrantes,
      count(*) filter (where direccion = 'saliente') as salientes,
      count(*) as total
    from filtrado
    group by clave
  ),
  con_total as (
    select a.*, sum(a.total) over () as total_general
    from agrupado a
  )
  select
    contacto,
    coalesce(nombre, '') as nombre,
    entrantes,
    salientes,
    total,
    round(100.0 * total / nullif(total_general, 0), 1) as porcentaje,
    round(
      100.0 * sum(total) over (order by total desc, contacto)
        / nullif(total_general, 0),
      1
    ) as acumulado
  from con_total
  order by total desc, contacto
  limit p_limite;
$$;

comment on function public.correo_ranking_contactos is
  'Ranking de interlocutores de un buzón con porcentaje acumulado (regla 80/20). PRP-094.';


-- ── 2. Volumen día a día ────────────────────────────────────────────────────
-- Una fila por día del rango, con lo que entró y lo que salió. Los días sin
-- correo NO se rellenan aquí: el panel sabe qué días pide y pinta el hueco.
create or replace function public.correo_serie_dias(
  p_desde date,
  p_hasta date,
  p_buzon_ids uuid[] default null,
  p_incluir_automaticos boolean default true
)
returns table (
  dia        date,
  entrantes  bigint,
  salientes  bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    m.dia_empresa as dia,
    count(*) filter (where m.direccion = 'entrante') as entrantes,
    count(*) filter (where m.direccion = 'saliente') as salientes
  from public.correo_mensajes m
  where m.dia_empresa between p_desde and p_hasta
    and (p_buzon_ids is null or m.buzon_id = any(p_buzon_ids))
    and (p_incluir_automaticos or not m.automatico)
  group by m.dia_empresa
  order by m.dia_empresa;
$$;

comment on function public.correo_serie_dias is
  'Correo entrante y saliente por día, en el día de la empresa. PRP-094.';


-- ── 3. Cuántos interlocutores distintos ─────────────────────────────────────
-- Va aparte del ranking porque el ranking se corta en las 100 filas de cabeza:
-- si el contador saliera de ahí, un buzón con 400 contactos diría 100, y el dato
-- sería falso justo en los buzones que más correo mueven.
create or replace function public.correo_contactos_distintos(
  p_desde date,
  p_hasta date,
  p_buzon_ids uuid[] default null,
  p_por_dominio boolean default false,
  p_incluir_automaticos boolean default true
)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select count(distinct
    case when p_por_dominio then m.contraparte_dominio else m.contraparte_email end)
  from public.correo_mensajes m
  where m.dia_empresa between p_desde and p_hasta
    and (p_buzon_ids is null or m.buzon_id = any(p_buzon_ids))
    and (p_incluir_automaticos or not m.automatico)
    and coalesce(nullif(
      case when p_por_dominio then m.contraparte_dominio else m.contraparte_email end,
    ''), '') <> '';
$$;
