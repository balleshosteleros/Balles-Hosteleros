-- El segmento de una campaña, resuelto DENTRO de la base de datos.
--
-- Antes esto se hacía en el servidor: se traía las fichas de la empresa por
-- páginas y las juzgaba una a una. Correcto y legible, pero con veinte mil
-- clientes tardaba veinte segundos por consulta, y el contador de "a cuánta
-- gente le llega" se recalcula cada vez que se toca un filtro. Aquí tarda
-- veinte milisegundos.
--
-- Cuatro funciones, de la más pequeña a la más grande:
--
--   nota_media_cliente        -> la media de lo que puntuó, o NULL si no valoró.
--   proximo_cumple            -> el día que le toca soplar velas.
--   sql_condicion_segmento    -> convierte UNA condición en un trozo de SQL.
--   clientes_del_segmento     -> monta la consulta entera y devuelve a quién
--                                escribir. `contar_…` hace lo mismo sin traerse
--                                a nadie.
--
-- Las condiciones son las mismas que ofrece el editor de campañas: añadir una
-- nueva es añadir un WHEN aquí y una línea en el desplegable, y no hay más
-- sitios que tocar.
--
-- ── Por qué se construye SQL con texto ────────────────────────────────────
-- La alternativa era una función que juzgara la ficha entera fila a fila. Se
-- probó: 1,7 s por recuento, casi todo en construir esa fila veinte mil veces.
-- Escrita directamente en el WHERE, la misma condición tarda 142 ms y además
-- Postgres puede usar los índices.
--
-- Los valores se interpolan con %L y SIEMPRE después de convertirlos a su tipo
-- (::int, ::date, ::numeric, ::uuid): la conversión revienta con cualquier cosa
-- que no sea un número, una fecha o un identificador, así que por aquí no entra
-- SQL de nadie.
--
-- Idempotente.

------------------------------------------------------------------
-- Nota media del cliente. NULL si nunca valoró, que NO es un cero.
------------------------------------------------------------------
create or replace function public.nota_media_cliente(c public.clientes_sala)
returns numeric
language sql immutable set search_path = public, pg_temp
as $fn$
  select avg(n) from (
    values (c.valoracion_cocina), (c.valoracion_servicio), (c.valoracion_ambiente)
  ) as v(n) where n is not null;
$fn$;

------------------------------------------------------------------
-- El próximo cumpleaños, a partir de una fecha.
------------------------------------------------------------------
--
-- Se compara día contra día y se da la vuelta al calendario si el de este año ya
-- pasó: sin eso, "los que cumplen en los próximos quince días" dejaría fuera a
-- los de primeros de enero cada vez que se mira en diciembre.
--
-- Solo el 29 de febrero necesita cuidado: en un año que no es bisiesto se sopla
-- el 28. El resto es aritmética, sin date_trunc ni intervalos, que era lo que
-- hacía cara esta función cuando se la llama veinte mil veces seguidas.
create or replace function public.proximo_cumple(p_nacimiento date, p_desde date)
returns date
language sql immutable set search_path = public, pg_temp
as $fn$
  with d as (
    select extract(month from p_nacimiento)::int as m,
           extract(day   from p_nacimiento)::int as dia,
           extract(year  from p_desde)::int      as anio
  ),
  este as (
    select make_date(
             d.anio, d.m,
             case when d.m = 2 and d.dia = 29
                       and not ((d.anio % 4 = 0 and d.anio % 100 <> 0) or d.anio % 400 = 0)
                  then 28 else d.dia end
           ) as dia_este
      from d
  )
  select case
           when e.dia_este >= p_desde then e.dia_este
           else make_date(
                  d.anio + 1, d.m,
                  case when d.m = 2 and d.dia = 29
                            and not (((d.anio + 1) % 4 = 0 and (d.anio + 1) % 100 <> 0)
                                     or (d.anio + 1) % 400 = 0)
                       then 28 else d.dia end
                )
         end
    from d, este e;
$fn$;

------------------------------------------------------------------
-- Una condición → un trozo de SQL.
------------------------------------------------------------------
create or replace function public.sql_condicion_segmento(cond jsonb, hoy date)
returns text
language sql immutable set search_path = public, pg_temp
as $fn$
  select case cond->>'tipo'

    -- ── Qué clase de cliente es ──
    when 'clasificacion' then
      case when jsonb_array_length(coalesce(cond->'valores','[]'::jsonb)) = 0 then 'true'
      else format('coalesce(c.clasificacion,'''') = any (%L::text[])',
                  (select array_agg(v) from jsonb_array_elements_text(cond->'valores') v))
      end
    when 'visitas_min' then format('coalesce(c.visitas,0) >= %L::int', (cond->>'min')::int)
    when 'visitas_max' then format('coalesce(c.visitas,0) <= %L::int', (cond->>'max')::int)

    -- ── Cuándo vino ──
    when 'ultima_visita_hace_dias' then
      format('c.ultima_visita >= %L::date', hoy - (cond->>'max')::int)
    -- Quien no ha venido NUNCA también lleva sin venir: entra.
    when 'sin_visitar_desde_dias' then
      format('(c.ultima_visita is null or c.ultima_visita < %L::date)', hoy - (cond->>'min')::int)
    when 'ultima_visita_antes' then
      format('c.ultima_visita < %L::date', (cond->>'fecha')::date)
    when 'ultima_visita_despues' then
      format('c.ultima_visita > %L::date', (cond->>'fecha')::date)

    -- ── Desde cuándo es cliente ──
    when 'alta_antes' then format('c.created_at < %L::date', (cond->>'fecha')::date)
    when 'alta_despues' then
      format('c.created_at >= (%L::date + 1)', (cond->>'fecha')::date)

    -- ── Etiquetas de su ficha ──
    when 'etiquetas' then
      case
        when jsonb_array_length(coalesce(cond->'etiquetaIds','[]'::jsonb)) = 0 then 'true'
        when coalesce(cond->>'modo','alguna') = 'todas' then
          format(
            '(select count(distinct ce.etiqueta_id) from public.sala_cliente_etiquetas ce'
            || ' where ce.cliente_id = c.id and ce.etiqueta_id = any (%L::uuid[])) = %L::int',
            (select array_agg(v::uuid) from jsonb_array_elements_text(cond->'etiquetaIds') v),
            jsonb_array_length(cond->'etiquetaIds'))
        else
          format(
            'exists (select 1 from public.sala_cliente_etiquetas ce'
            || ' where ce.cliente_id = c.id and ce.etiqueta_id = any (%L::uuid[]))',
            (select array_agg(v::uuid) from jsonb_array_elements_text(cond->'etiquetaIds') v))
      end

    -- ── Qué opina. Nunca haber valorado NO es un cero. ──
    when 'valoracion_min' then
      format('coalesce(c.valoraciones_num,0) > 0 and public.nota_media_cliente(c) >= %L::numeric',
             (cond->>'min')::numeric)
    when 'valoracion_max' then
      format('coalesce(c.valoraciones_num,0) > 0 and public.nota_media_cliente(c) <= %L::numeric',
             (cond->>'max')::numeric)
    when 'ha_valorado' then
      case when coalesce((cond->>'valor')::boolean, true)
           then 'coalesce(c.valoraciones_num,0) > 0'
           else 'coalesce(c.valoraciones_num,0) = 0' end

    -- ── Su cumpleaños ──
    when 'cumple_mes' then
      case when jsonb_array_length(coalesce(cond->'meses','[]'::jsonb)) = 0 then 'false'
      else format('extract(month from c.fecha_nacimiento)::int = any (%L::int[])',
                  (select array_agg(v::int) from jsonb_array_elements_text(cond->'meses') v))
      end
    when 'cumple_en_dias' then
      format('c.fecha_nacimiento is not null and public.proximo_cumple(c.fecha_nacimiento, %L::date) <= %L::date',
             hoy, hoy + (cond->>'dias')::int)

    -- ── Cómo se porta ──
    when 'no_shows_max' then format('coalesce(c.no_shows,0) <= %L::int', (cond->>'max')::int)
    when 'cancelaciones_max' then format('coalesce(c.cancelaciones,0) <= %L::int', (cond->>'max')::int)

    -- Una condición que este servidor todavía no conoce (campaña guardada por
    -- una versión más nueva) no descarta a nadie.
    else 'true'
  end;
$fn$;

------------------------------------------------------------------
-- A quién le toca la campaña.
------------------------------------------------------------------
--
-- `p_canal` ('email' | 'whatsapp' | 'sms') exige dato de contacto y, si
-- `p_con_permiso`, permiso comercial EN ESE CANAL: quien aceptó correos no
-- aceptó que le escriban al móvil. `p_canal` a NULL devuelve solo el filtro, que
-- es la cifra de "a cuánta gente describe esto".
--
-- Sin permiso se sigue exigiendo el dato de contacto: sin dirección no hay a
-- dónde escribir por mucho que la ficha encaje.
create or replace function public.clientes_del_segmento(
  p_empresa_id  uuid,
  p_segmento    jsonb,
  p_canal       text default null,
  p_con_permiso boolean default true,
  p_hoy         date default null
) returns table (id uuid, email text, telefono text)
language plpgsql stable set search_path = public, pg_temp
as $fn$
declare
  v_hoy    date   := coalesce(p_hoy, current_date);
  v_op     text   := upper(coalesce(p_segmento->>'operador','AND'));
  v_partes text[] := '{}';
  v_filtro text;
  v_canal  text   := 'true';
  cond     jsonb;
begin
  for cond in
    select * from jsonb_array_elements(coalesce(p_segmento->'condiciones','[]'::jsonb))
  loop
    v_partes := v_partes || public.sql_condicion_segmento(cond, v_hoy);
  end loop;

  -- Sin condiciones el segmento es "toda la casa", no "nadie".
  if coalesce(array_length(v_partes,1),0) = 0 then
    v_filtro := 'true';
  elsif v_op = 'OR' then
    v_filtro := '(' || array_to_string(v_partes, ' or ') || ')';
  else
    v_filtro := '(' || array_to_string(v_partes, ' and ') || ')';
  end if;

  if p_canal is not null then
    if p_canal = 'email' then
      v_canal := 'coalesce(btrim(c.email),'''') <> ''''';
      if p_con_permiso then
        v_canal := v_canal || ' and coalesce(c.acepta_marketing_email,false)';
      end if;
    elsif p_canal in ('whatsapp','sms') then
      v_canal := 'coalesce(btrim(c.telefono),'''') <> ''''';
      if p_con_permiso then
        v_canal := v_canal || format(' and coalesce(c.acepta_marketing_%s,false)', p_canal);
      end if;
    else
      raise exception 'Canal desconocido: %', p_canal;
    end if;
  end if;

  return query execute format(
    'select c.id, c.email, c.telefono from public.clientes_sala c'
    || ' where c.empresa_id = %L and %s and %s',
    p_empresa_id, v_filtro, v_canal);
end;
$fn$;

------------------------------------------------------------------
-- Contar sin traerse a nadie.
------------------------------------------------------------------
--
-- Para pintar "a 117 personas", devolver las fichas significa mandar veinte mil
-- filas por la red para tirarlas al llegar: dos segundos por cada filtro que se
-- toca. El recuento se queda aquí y viaja un número.
create or replace function public.contar_clientes_del_segmento(
  p_empresa_id  uuid,
  p_segmento    jsonb,
  p_canal       text default null,
  p_con_permiso boolean default true,
  p_hoy         date default null
) returns integer
language sql stable set search_path = public, pg_temp
as $fn$
  select count(*)::int
    from public.clientes_del_segmento(p_empresa_id, p_segmento, p_canal, p_con_permiso, p_hoy);
$fn$;

-- Versión anterior, que juzgaba la ficha entera fila a fila: era la lenta.
drop function if exists public.cumple_condicion_segmento(public.clientes_sala, jsonb, date);

grant execute on function public.nota_media_cliente(public.clientes_sala) to authenticated, service_role;
grant execute on function public.proximo_cumple(date, date) to authenticated, service_role;
grant execute on function public.sql_condicion_segmento(jsonb, date) to authenticated, service_role;
grant execute on function public.clientes_del_segmento(uuid, jsonb, text, boolean, date) to authenticated, service_role;
grant execute on function public.contar_clientes_del_segmento(uuid, jsonb, text, boolean, date) to authenticated, service_role;
