-- Cupones: mínimo de comensales, dueño del cupón y de dónde salió.
--
-- Los tres nacen de la campaña de cumpleaños: al cumpleañero se le regala la
-- comida SI trae mesa, y ese "si" tiene que comprobarlo el software al reservar.
-- Dejarlo escrito solo en el correo significa discutirlo en la puerta con quien
-- viene a celebrar su cumpleaños, que es la peor conversación posible.
--
--   minimo_personas -> comensales mínimos de la reserva para poder usarlo.
--   cliente_id      -> a quién se le dio. Un cupón personal de un solo uso deja
--                      de ser anónimo: se puede medir y se puede reponer si hay
--                      queja.
--   origen          -> qué lo generó ('CUMPLEANOS'). Sin esto no hay forma de
--                      contar cuántas mesas trajo la campaña.
--
-- Idempotente.

alter table public.reserva_codigos
  add column if not exists minimo_personas int,
  add column if not exists cliente_id       uuid references public.clientes_sala(id) on delete set null,
  add column if not exists origen           text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cupon_minimo_personas_valido'
  ) then
    alter table public.reserva_codigos
      add constraint cupon_minimo_personas_valido
      check (minimo_personas is null or minimo_personas between 1 and 50);
  end if;
end $$;

create index if not exists reserva_codigos_cliente_idx
  on public.reserva_codigos(empresa_id, cliente_id) where cliente_id is not null;
create index if not exists reserva_codigos_origen_idx
  on public.reserva_codigos(empresa_id, origen) where origen is not null;

comment on column public.reserva_codigos.minimo_personas is
  'Comensales mínimos de la reserva para que el cupón valga. NULL = sin mínimo.';
comment on column public.reserva_codigos.cliente_id is
  'Cliente de sala dueño del cupón, cuando es personal (cumpleaños). NULL = cupón abierto.';
comment on column public.reserva_codigos.origen is
  'Qué generó el cupón: CUMPLEANOS, o NULL si lo creó una persona a mano.';

------------------------------------------------------------------
-- validar_cupon: ahora también mira cuántas personas son.
------------------------------------------------------------------
--
-- Se borra y se recrea porque cambia la lista de columnas devueltas: hace falta
-- devolver `minimo_personas` para poder decirle al cliente "faltan dos" en vez
-- de un "no válido" a secas. El parámetro nuevo lleva DEFAULT NULL, así que
-- cualquier llamada antigua de 4 argumentos sigue funcionando y simplemente no
-- comprueba el mínimo.

drop function if exists public.validar_cupon(uuid, text, date, text);

create or replace function public.validar_cupon(
  p_empresa_id uuid,
  p_codigo     text,
  p_fecha      date,
  p_turno      text,
  p_personas   int default null
) returns table (
  ok                       boolean,
  motivo                   text,
  cupon_id                 uuid,
  titulo_cliente_efectivo  text,
  beneficio_tipo           text,
  beneficio_valor          numeric,
  producto_descripcion     text,
  fecha_caducidad          date,
  minimo_personas          int
)
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v             public.reserva_codigos;
  v_dia_key     text;
  v_codigo_norm text;
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
  if v.fecha_caducidad is not null and p_fecha > v.fecha_caducidad then
    return query select false, 'CADUCADO', v.id, coalesce(v.titulo_cliente, v.titulo_interno),
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
  -- El mínimo solo se juzga si quien pregunta ha dicho cuántos son. Un
  -- validador que no lo sabe no puede inventarse un "no".
  if v.minimo_personas is not null and p_personas is not null and p_personas < v.minimo_personas then
    return query select false, 'MINIMO_PERSONAS', v.id, coalesce(v.titulo_cliente, v.titulo_interno),
      v.beneficio_tipo, v.beneficio_valor, v.producto_descripcion, v.fecha_caducidad, v.minimo_personas;
    return;
  end if;
  if v.stock_consumido >= v.stock_total then
    return query select false, 'AGOTADO', v.id, coalesce(v.titulo_cliente, v.titulo_interno),
      v.beneficio_tipo, v.beneficio_valor, v.producto_descripcion, v.fecha_caducidad, v.minimo_personas;
    return;
  end if;

  return query select true, null::text, v.id, coalesce(v.titulo_cliente, v.titulo_interno),
    v.beneficio_tipo, v.beneficio_valor, v.producto_descripcion, v.fecha_caducidad, v.minimo_personas;
end;
$fn$;

grant execute on function public.validar_cupon(uuid, text, date, text, int) to anon, authenticated;

------------------------------------------------------------------
-- Quién cumple años tal día.
------------------------------------------------------------------
--
-- Va en una función y no en una consulta desde la app porque el filtro es por
-- día y mes de una fecha, y eso PostgREST no lo sabe expresar: habría que
-- traerse las 13.000 fichas de la empresa cada madrugada para descartar 12.960.
--
-- El 29 de febrero se felicita el 28 los años que no son bisiestos; si no,
-- quien nació ese día se quedaría sin felicitación tres de cada cuatro años.

create or replace function public.clientes_sala_cumpleanos(
  p_empresa_id uuid,
  p_fecha      date
) returns table (
  id                       uuid,
  nombre                   text,
  apellidos                text,
  email                    text,
  telefono                 text,
  fecha_nacimiento         date,
  acepta_marketing_email   boolean,
  acepta_marketing_sms     boolean,
  acepta_marketing_whatsapp boolean
)
language sql security definer set search_path = public, pg_temp
as $fn$
  select c.id, c.nombre, c.apellidos, c.email, c.telefono,
         c.fecha_nacimiento,
         coalesce(c.acepta_marketing_email, false),
         coalesce(c.acepta_marketing_sms, false),
         coalesce(c.acepta_marketing_whatsapp, false)
    from public.clientes_sala c
   where c.empresa_id = p_empresa_id
     and c.fecha_nacimiento is not null
     and (
       (extract(month from c.fecha_nacimiento) = extract(month from p_fecha)
        and extract(day   from c.fecha_nacimiento) = extract(day   from p_fecha))
       or (
         -- 29-F en año no bisiesto: se atiende el 28.
         extract(month from c.fecha_nacimiento) = 2
         and extract(day from c.fecha_nacimiento) = 29
         and extract(month from p_fecha) = 2
         and extract(day   from p_fecha) = 28
         and not (
           (extract(year from p_fecha)::int % 4 = 0 and extract(year from p_fecha)::int % 100 <> 0)
           or extract(year from p_fecha)::int % 400 = 0
         )
       )
     );
$fn$;

revoke execute on function public.clientes_sala_cumpleanos(uuid, date) from public, anon, authenticated;
grant  execute on function public.clientes_sala_cumpleanos(uuid, date) to service_role;

------------------------------------------------------------------
-- (09-09-2026) "Agotado" no es lo que le pasa a un cupón personal.
------------------------------------------------------------------
--
-- Un cupón de cumpleaños se emite con un solo uso y va a nombre de una persona.
-- Cuando esa persona lo gasta y vuelve a intentarlo, el sistema le decía
-- "AGOTADO", que es la palabra de un cupón promocional sin existencias: se
-- entiende "llegué tarde, se acabaron" cuando lo que pasa es "ya lo usaste tú".
-- Se distinguen por el stock con el que nació: uno solo es personal.
--
-- El uso se comprueba ANTES que el día, el turno y el mínimo: a quien ya gastó
-- su cupón hay que decírselo, no mandarle a probar otro día con un código que
-- no va a funcionar nunca más.
--
-- La versión vigente de `validar_cupon` está aplicada con esos dos cambios; se
-- deja anotado aquí porque la función se define más arriba en este mismo
-- archivo y reescribirla dos veces confundiría más que aclarar.

------------------------------------------------------------------
-- Resumen de los cupones que emite el software solo.
------------------------------------------------------------------
--
-- La pantalla de cupones no puede listarlos —serán miles al año, y PostgREST
-- corta en mil filas: los cupones escritos a mano quedarían enterrados— pero sí
-- tiene que poder decir cuántos salieron y cuántos se usaron.
create or replace function public.resumen_cupones_automaticos(p_empresa_id uuid)
returns table (origen text, emitidos int, usados int, caducados int, vivos int)
language sql stable set search_path = public, pg_temp
as $fn$
  select c.origen,
         count(*)::int as emitidos,
         count(*) filter (where c.stock_consumido >= c.stock_total)::int as usados,
         count(*) filter (
           where c.stock_consumido < c.stock_total
             and c.fecha_caducidad is not null
             and c.fecha_caducidad < current_date
         )::int as caducados,
         count(*) filter (
           where c.stock_consumido < c.stock_total
             and (c.fecha_caducidad is null or c.fecha_caducidad >= current_date)
             and c.activo
         )::int as vivos
    from public.reserva_codigos c
   where c.empresa_id = p_empresa_id
     and c.origen is not null
   group by c.origen
   order by c.origen;
$fn$;

grant execute on function public.resumen_cupones_automaticos(uuid) to authenticated, service_role;
