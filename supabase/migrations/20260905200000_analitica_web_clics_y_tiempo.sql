-- Que la web diga QUE hace la gente dentro, no solo cuanta entra.
--
-- Hasta ahora se contaba la visita y nada mas: se sabia que entraron 300
-- personas, pero no si pulsaron "Reservar", si se fueron a los 4 segundos ni
-- de donde venian. Con eso no se puede decidir nada.
--
-- Se anaden tres medidas, todas agregadas por dia como las visitas:
--   1. Clics de cada boton de la web.
--   2. Tiempo de la visita (suma de segundos + numero de visitas medidas) y
--      cuantas se fueron sin tocar nada (rebote).
--   3. De donde llega la gente (Google, Instagram, directo...).
--
-- SIN COOKIES Y SIN IP. No se guarda ningun identificador de persona ni de
-- navegador: la fila es un contador por dia, igual que las visitas. Por eso no
-- hace falta banner de consentimiento y se mide el 100% del trafico, no solo
-- el de quien acepta cookies.
--
-- Idempotente: se puede volver a aplicar sin romper nada.

-- 1. Clics de los botones ───────────────────────────────────────────────────
-- Un boton se identifica por su DESTINO (href) mas su texto, no por un id: los
-- bloques se editan y se reordenan constantemente, y un id se perderia en cada
-- cambio. El destino sobrevive a la edicion y es lo que de verdad importa
-- ("cuantos se fueron al portal de reservas").
create table if not exists public.paginas_web_clics (
  id          uuid primary key default gen_random_uuid(),
  pagina_id   uuid not null references public.paginas_web(id) on delete cascade,
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  fecha       date not null,
  destino     text not null,
  etiqueta    text not null default '',
  dispositivo text not null default 'otro',
  total       bigint not null default 0,

  constraint paginas_web_clics_unq
    unique (pagina_id, fecha, destino, etiqueta, dispositivo),
  constraint paginas_web_clics_dispositivo_chk
    check (dispositivo in ('movil', 'tablet', 'escritorio', 'otro'))
);

comment on table public.paginas_web_clics is
  'Cuantas veces se pulsa cada boton de cada pagina publica, agregado por dia. Sin IP ni identificador de persona.';

create index if not exists idx_paginas_web_clics_pagina_fecha
  on public.paginas_web_clics (pagina_id, fecha desc);

create index if not exists idx_paginas_web_clics_empresa_fecha
  on public.paginas_web_clics (empresa_id, fecha desc);

-- 2. Tiempo de la visita ────────────────────────────────────────────────────
-- No se guarda la duracion de cada visita suelta (eso seria seguir a una
-- persona), sino la SUMA de segundos y CUANTAS visitas se han medido. La media
-- sale de dividir: total_segundos / visitas_medidas.
--
-- `visitas_medidas` no coincide con las visitas de `paginas_web_visitas`: solo
-- cuenta las que llegaron a mandar su tiempo al cerrar. Quien mata el navegador
-- de golpe no manda nada, y la media debe salir sobre lo realmente medido.
create table if not exists public.paginas_web_tiempo (
  id              uuid primary key default gen_random_uuid(),
  pagina_id       uuid not null references public.paginas_web(id) on delete cascade,
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  fecha           date not null,
  dispositivo     text not null default 'otro',
  total_segundos  bigint not null default 0,
  visitas_medidas bigint not null default 0,
  -- Visitas que se fueron sin pulsar nada ni bajar por la pagina.
  rebotes         bigint not null default 0,

  constraint paginas_web_tiempo_unq unique (pagina_id, fecha, dispositivo),
  constraint paginas_web_tiempo_dispositivo_chk
    check (dispositivo in ('movil', 'tablet', 'escritorio', 'otro'))
);

comment on table public.paginas_web_tiempo is
  'Segundos totales y numero de visitas medidas por dia, para calcular el tiempo medio. Sin IP ni identificador de persona.';

create index if not exists idx_paginas_web_tiempo_pagina_fecha
  on public.paginas_web_tiempo (pagina_id, fecha desc);

-- 3. De donde llega la gente ────────────────────────────────────────────────
-- El origen se guarda ya normalizado a una familia corta ("google",
-- "instagram", "directo"...), no la URL entera de procedencia: la URL completa
-- puede llevar datos de la sesion de quien enlaza y no aporta nada.
create table if not exists public.paginas_web_origenes (
  id         uuid primary key default gen_random_uuid(),
  pagina_id  uuid not null references public.paginas_web(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  fecha      date not null,
  origen     text not null default 'directo',
  total      bigint not null default 0,

  constraint paginas_web_origenes_unq unique (pagina_id, fecha, origen)
);

comment on table public.paginas_web_origenes is
  'De donde llega cada visita (buscador, red social, enlace directo), agregado por dia.';

create index if not exists idx_paginas_web_origenes_pagina_fecha
  on public.paginas_web_origenes (pagina_id, fecha desc);

-- 4. RLS ────────────────────────────────────────────────────────────────────
-- Solo lectura desde el navegador y solo de las empresas del usuario. Los
-- INSERT los hace el servidor con la service-role: quien visita la web es un
-- anonimo sin cuenta en el sistema.
alter table public.paginas_web_clics    enable row level security;
alter table public.paginas_web_tiempo   enable row level security;
alter table public.paginas_web_origenes enable row level security;

drop policy if exists "paginas_web_clics_select" on public.paginas_web_clics;
create policy "paginas_web_clics_select" on public.paginas_web_clics
  for select to authenticated
  using (empresa_id in (select empresas_del_usuario()));

drop policy if exists "paginas_web_tiempo_select" on public.paginas_web_tiempo;
create policy "paginas_web_tiempo_select" on public.paginas_web_tiempo
  for select to authenticated
  using (empresa_id in (select empresas_del_usuario()));

drop policy if exists "paginas_web_origenes_select" on public.paginas_web_origenes;
create policy "paginas_web_origenes_select" on public.paginas_web_origenes
  for select to authenticated
  using (empresa_id in (select empresas_del_usuario()));

-- 5. Dia local de la empresa ────────────────────────────────────────────────
-- Mismo criterio que las visitas: la fecha la decide la zona horaria de la
-- empresa, no el UTC del servidor. Un clic de la 01:00 de un sabado en Madrid
-- pertenece al sabado del restaurante, no al viernes.
create or replace function public.paginas_web_dia_local(p_empresa_id uuid)
returns date
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_zona text;
begin
  select nullif(trim(coalesce(config_operativa->>'zonaHoraria', '')), '')
    into v_zona
    from public.empresas
   where id = p_empresa_id;

  -- Una zona escrita a mano y mal ("Madrid" en vez de "Europe/Madrid") tumbaria
  -- el registro entero. Antes de perder el dato, se cae a Madrid.
  begin
    return (now() at time zone coalesce(v_zona, 'Europe/Madrid'))::date;
  exception when others then
    return (now() at time zone 'Europe/Madrid')::date;
  end;
end;
$$;

-- 6. Registrar un clic ──────────────────────────────────────────────────────
create or replace function public.paginas_web_registrar_clic(
  p_pagina_id   uuid,
  p_destino     text,
  p_etiqueta    text default '',
  p_dispositivo text default 'otro'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_disp    text;
  v_destino text;
  v_etiq    text;
begin
  select empresa_id into v_empresa
    from public.paginas_web
   where id = p_pagina_id;

  if v_empresa is null then
    return;
  end if;

  -- Se recortan a lo que cabe en pantalla: un href larguisimo generado por una
  -- campana no debe crear una fila distinta por cada variante del parametro.
  v_destino := left(trim(coalesce(p_destino, '')), 300);
  v_etiq    := left(trim(coalesce(p_etiqueta, '')), 120);

  if v_destino = '' then
    return;
  end if;

  v_disp := case
    when p_dispositivo in ('movil', 'tablet', 'escritorio') then p_dispositivo
    else 'otro'
  end;

  insert into public.paginas_web_clics
    (pagina_id, empresa_id, fecha, destino, etiqueta, dispositivo, total)
  values
    (p_pagina_id, v_empresa, public.paginas_web_dia_local(v_empresa),
     v_destino, v_etiq, v_disp, 1)
  on conflict (pagina_id, fecha, destino, etiqueta, dispositivo)
  do update set total = public.paginas_web_clics.total + 1;
end;
$$;

-- 7. Registrar el tiempo de una visita ──────────────────────────────────────
create or replace function public.paginas_web_registrar_tiempo(
  p_pagina_id   uuid,
  p_segundos    integer,
  p_interactuo  boolean default false,
  p_dispositivo text default 'otro'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_disp    text;
  v_seg     integer;
begin
  select empresa_id into v_empresa
    from public.paginas_web
   where id = p_pagina_id;

  if v_empresa is null then
    return;
  end if;

  -- Tope de 2 horas: una pestana olvidada abierta toda la noche desviaria la
  -- media hasta volverla inutil. Y nunca negativo, venga lo que venga de fuera.
  v_seg := greatest(0, least(coalesce(p_segundos, 0), 7200));

  v_disp := case
    when p_dispositivo in ('movil', 'tablet', 'escritorio') then p_dispositivo
    else 'otro'
  end;

  insert into public.paginas_web_tiempo
    (pagina_id, empresa_id, fecha, dispositivo, total_segundos, visitas_medidas, rebotes)
  values
    (p_pagina_id, v_empresa, public.paginas_web_dia_local(v_empresa),
     v_disp, v_seg, 1, case when p_interactuo then 0 else 1 end)
  on conflict (pagina_id, fecha, dispositivo)
  do update set
    total_segundos  = public.paginas_web_tiempo.total_segundos + v_seg,
    visitas_medidas = public.paginas_web_tiempo.visitas_medidas + 1,
    rebotes         = public.paginas_web_tiempo.rebotes
                      + case when p_interactuo then 0 else 1 end;
end;
$$;

-- 8. Registrar el origen de una visita ──────────────────────────────────────
create or replace function public.paginas_web_registrar_origen(
  p_pagina_id uuid,
  p_origen    text default 'directo'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_origen  text;
begin
  select empresa_id into v_empresa
    from public.paginas_web
   where id = p_pagina_id;

  if v_empresa is null then
    return;
  end if;

  v_origen := left(nullif(trim(lower(coalesce(p_origen, ''))), ''), 60);
  if v_origen is null then
    v_origen := 'directo';
  end if;

  insert into public.paginas_web_origenes (pagina_id, empresa_id, fecha, origen, total)
  values (p_pagina_id, v_empresa, public.paginas_web_dia_local(v_empresa), v_origen, 1)
  on conflict (pagina_id, fecha, origen)
  do update set total = public.paginas_web_origenes.total + 1;
end;
$$;

-- 9. Permisos ───────────────────────────────────────────────────────────────
revoke all on function public.paginas_web_dia_local(uuid) from public;
revoke all on function public.paginas_web_registrar_clic(uuid, text, text, text) from public;
revoke all on function public.paginas_web_registrar_tiempo(uuid, integer, boolean, text) from public;
revoke all on function public.paginas_web_registrar_origen(uuid, text) from public;

-- `revoke ... from public` NO basta en Supabase: los roles `anon` y
-- `authenticated` llevan su propio grant por defecto, asi que la funcion queda
-- expuesta en /rest/v1/rpc/... y cualquiera con la clave publica podria inflar
-- los contadores desde fuera. Se les quita explicitamente.
revoke execute on function public.paginas_web_dia_local(uuid) from anon, authenticated;
revoke execute on function public.paginas_web_registrar_clic(uuid, text, text, text) from anon, authenticated;
revoke execute on function public.paginas_web_registrar_tiempo(uuid, integer, boolean, text) from anon, authenticated;
revoke execute on function public.paginas_web_registrar_origen(uuid, text) from anon, authenticated;

grant execute on function public.paginas_web_registrar_clic(uuid, text, text, text) to service_role;
grant execute on function public.paginas_web_registrar_tiempo(uuid, integer, boolean, text) to service_role;
grant execute on function public.paginas_web_registrar_origen(uuid, text) to service_role;
