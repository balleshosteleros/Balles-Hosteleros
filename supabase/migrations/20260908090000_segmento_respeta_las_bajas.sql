-- ============================================================
-- El segmento respeta las bajas, mande lo que mande la campaña.
--
-- `clientes_del_segmento` mira la casilla de permiso cuando la campaña lo pide
-- (`p_con_permiso`), pero no miraba la fecha de baja. Con una campaña marcada
-- como "escribir también a quien no dio permiso" —que es una opción legítima:
-- la mayoría de la base entró migrada y nadie le preguntó— entraban también los
-- que pulsaron "no quiero recibir más".
--
-- Eso no es una opción que se pueda elegir. Escribir a quien pidió la baja es
-- ilegal, y en la práctica es lo que hace que marque el correo como spam: con
-- ello cae la reputación del dominio y acaban en no deseados hasta las
-- confirmaciones de reserva de los demás clientes.
--
-- Por eso la baja se comprueba SIEMPRE, fuera del `if` del permiso.
--
-- Idempotente: reemplaza la función.
-- ============================================================

create or replace function public.clientes_del_segmento(
  p_empresa_id uuid,
  p_segmento jsonb,
  p_canal text default null::text,
  p_con_permiso boolean default true,
  p_hoy date default null::date
)
returns table(id uuid, email text, telefono text)
language plpgsql
stable
set search_path to 'public', 'pg_temp'
as $function$
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

  if coalesce(array_length(v_partes,1),0) = 0 then
    v_filtro := 'true';
  elsif v_op = 'OR' then
    v_filtro := '(' || array_to_string(v_partes, ' or ') || ')';
  else
    v_filtro := '(' || array_to_string(v_partes, ' and ') || ')';
  end if;

  -- El canal exige dato de contacto y, salvo que la campaña lo desactive,
  -- permiso comercial EN ESE canal. La BAJA, en cambio, no se desactiva nunca.
  if p_canal is not null then
    if p_canal = 'email' then
      v_canal := 'coalesce(btrim(c.email),'''') <> '''' and c.marketing_baja_email_at is null';
      if p_con_permiso then
        v_canal := v_canal || ' and coalesce(c.acepta_marketing_email,false)';
      end if;
    elsif p_canal in ('whatsapp','sms') then
      v_canal := format(
        'coalesce(btrim(c.telefono),'''') <> '''' and c.marketing_baja_%s_at is null',
        p_canal);
      if p_con_permiso then
        v_canal := v_canal || format(' and coalesce(c.acepta_marketing_%s,false)', p_canal);
      end if;
    else
      raise exception 'Canal desconocido: %', p_canal;
    end if;
  end if;

  return query execute format(
    'select c.id, c.email, c.telefono from public.clientes_sala c'
    || ' where c.empresa_id = %L and %s and %s order by c.id',
    p_empresa_id, v_filtro, v_canal);
end;
$function$;

-- El contador tiene que dar el MISMO número que el envío: si dice nueve mil y
-- salen seis mil, nadie vuelve a fiarse de la cifra que se enseña antes de
-- enviar.
create or replace function public.contar_clientes_del_segmento(
  p_empresa_id uuid,
  p_segmento jsonb,
  p_canal text default null::text,
  p_con_permiso boolean default true,
  p_hoy date default null::date
)
returns integer
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  select count(*)::integer
  from public.clientes_del_segmento(p_empresa_id, p_segmento, p_canal, p_con_permiso, p_hoy);
$function$;
