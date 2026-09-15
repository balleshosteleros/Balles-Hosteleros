-- ============================================================
-- El cupón nominativo solo vale para quien lo recibió.
--
-- `reserva_codigos.cliente_id` dice de quién es cada cupón —los de cumpleaños
-- nacen con nombre y apellidos—, pero `validar_cupon` no lo miraba: comprobaba
-- el código, la caducidad, los usos, el día y el turno, y daba por bueno
-- cualquier código que existiera. Bastaba con que alguien reenviara el suyo por
-- WhatsApp para que lo usara otro.
--
-- Ahora, si el cupón tiene dueño, hay que reservar con SU correo. Se compara el
-- correo y no el identificador del cliente a propósito: quien reserva por la web
-- escribe su correo, y esa es la única prueba que tenemos en ese momento de que
-- es él. Se normaliza (sin espacios, en minúsculas) porque nadie escribe su
-- correo dos veces igual.
--
-- Los cupones SIN dueño (promociones generales, los que reparte sala) siguen
-- funcionando para cualquiera: ahí `cliente_id` es nulo y no hay nada que
-- comparar.
--
-- Parámetro nuevo al final y con valor por defecto: las llamadas que aún no
-- pasan el correo siguen compilando. Eso sí, un cupón con dueño sin correo que
-- comparar se rechaza —no se puede confirmar que sea suyo—, que es la respuesta
-- prudente cuando hay dinero de por medio.
-- ============================================================

create or replace function public.validar_cupon(
  p_empresa_id uuid,
  p_codigo text,
  p_fecha date,
  p_turno text,
  p_personas integer default null::integer,
  p_email text default null::text
)
returns table(
  ok boolean, motivo text, cupon_id uuid, titulo_cliente_efectivo text,
  beneficio_tipo text, beneficio_valor numeric, producto_descripcion text,
  fecha_caducidad date, minimo_personas integer
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v             public.reserva_codigos;
  v_dia_key     text;
  v_codigo_norm text;
  v_email_norm  text;
  v_email_dueno text;
begin
  v_codigo_norm := upper(regexp_replace(coalesce(p_codigo,''), '\s+', '', 'g'));
  if v_codigo_norm !~ '^[A-Z0-9]{6}$' then
    return query select false, 'NO_EXISTE', null::uuid, null::text, null::text, null::numeric, null::text, null::date, null::int;
    return;
  end if;

  select * into v from public.reserva_codigos
    where empresa_id = p_empresa_id and codigo = v_codigo_norm limit 1;
  if v.id is null then
    return query select false, 'NO_EXISTE', null::uuid, null::text, null::text, null::numeric, null::text, null::date, null::int;
    return;
  end if;
  if not v.activo then
    return query select false, 'INACTIVO', v.id, coalesce(v.titulo_cliente, v.titulo_interno),
      v.beneficio_tipo, v.beneficio_valor, v.producto_descripcion, v.fecha_caducidad, v.minimo_personas;
    return;
  end if;

  -- ── De quién es ──────────────────────────────────────────────────────────
  -- Va antes que la caducidad y los usos: si el cupón no es suyo, lo demás da
  -- igual, y además no hay por qué contarle a un tercero si el cupón ajeno está
  -- gastado o cuándo caduca.
  if v.cliente_id is not null then
    select lower(btrim(coalesce(c.email, ''))) into v_email_dueno
      from public.clientes_sala c where c.id = v.cliente_id;
    v_email_norm := lower(btrim(coalesce(p_email, '')));
    if v_email_norm = '' or v_email_dueno = '' or v_email_norm <> v_email_dueno then
      return query select false, 'OTRO_CLIENTE', v.id, coalesce(v.titulo_cliente, v.titulo_interno),
        v.beneficio_tipo, v.beneficio_valor, v.producto_descripcion, v.fecha_caducidad, v.minimo_personas;
      return;
    end if;
  end if;

  if v.fecha_caducidad is not null and p_fecha > v.fecha_caducidad then
    return query select false, 'CADUCADO', v.id, coalesce(v.titulo_cliente, v.titulo_interno),
      v.beneficio_tipo, v.beneficio_valor, v.producto_descripcion, v.fecha_caducidad, v.minimo_personas;
    return;
  end if;
  -- El uso se comprueba ANTES que el día, el turno y el mínimo: a quien ya gastó
  -- su cupón hay que decírselo, no mandarle a probar otro día con un código que
  -- no va a funcionar nunca más.
  if v.stock_consumido >= v.stock_total then
    return query select false,
      case when v.stock_total = 1 then 'YA_USADO' else 'AGOTADO' end,
      v.id, coalesce(v.titulo_cliente, v.titulo_interno),
      v.beneficio_tipo, v.beneficio_valor, v.producto_descripcion, v.fecha_caducidad, v.minimo_personas;
    return;
  end if;
  v_dia_key := (array['dom','lun','mar','mie','jue','vie','sab'])[extract(dow from p_fecha)::int + 1];
  if not (v_dia_key = any (v.dias_semana)) then
    return query select false, 'DIA_NO_PERMITIDO', v.id, coalesce(v.titulo_cliente, v.titulo_interno),
      v.beneficio_tipo, v.beneficio_valor, v.producto_descripcion, v.fecha_caducidad, v.minimo_personas;
    return;
  end if;
  if p_turno is not null and not (p_turno = any (v.turnos)) then
    return query select false, 'TURNO_NO_PERMITIDO', v.id, coalesce(v.titulo_cliente, v.titulo_interno),
      v.beneficio_tipo, v.beneficio_valor, v.producto_descripcion, v.fecha_caducidad, v.minimo_personas;
    return;
  end if;
  if v.minimo_personas is not null and p_personas is not null and p_personas < v.minimo_personas then
    return query select false, 'MINIMO_PERSONAS', v.id, coalesce(v.titulo_cliente, v.titulo_interno),
      v.beneficio_tipo, v.beneficio_valor, v.producto_descripcion, v.fecha_caducidad, v.minimo_personas;
    return;
  end if;

  return query select true, null::text, v.id, coalesce(v.titulo_cliente, v.titulo_interno),
    v.beneficio_tipo, v.beneficio_valor, v.producto_descripcion, v.fecha_caducidad, v.minimo_personas;
end;
$function$;
