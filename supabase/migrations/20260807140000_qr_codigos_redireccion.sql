-- Gestor de códigos QR con redirección propia
--
-- El problema que resuelve (Iván, 07-ago-2026): los QR de las cartas se generaron
-- en GoHighLevel apuntando DIRECTAMENTE a `api.whatsapp.com/send?phone=...`. Como
-- el destino va grabado dentro de los cuadraditos y el dominio es de WhatsApp, esos
-- QR están atados de por vida: para cambiar a dónde llevan hay que reimprimir las
-- cartas, que cuesta dinero. Al cerrar GHL además se pierde la automatización.
--
-- A partir de ahora el QR NO apunta al destino final, apunta a un dominio NUESTRO
-- (`qr.balleshosteleros.com/<codigo>`) que redirige. El papel impreso deja de ser
-- una decisión irreversible: el destino se cambia desde el panel y la carta sigue
-- valiendo. Esa es toda la razón de ser de esta tabla.
--
-- Decisiones de negocio que materializa:
--   · El dominio es COMÚN a todas las empresas (presentes y futuras). Por eso el
--     código es único GLOBALMENTE, no por empresa: si `a3k9` fuera de dos empresas,
--     el sistema no sabría a dónde mandar el escaneo.
--   · Un código NUNCA se reutiliza, aunque se borre el QR. Si Bacanal libera `a3k9`
--     y meses después se le asignase a Habana, las cartas viejas de Bacanal que
--     sigan por ahí mandarían gente al restaurante equivocado. De ahí
--     `qr_codigos_quemados`: los códigos usados quedan retirados para siempre.
--   · El destino es historia, no un campo que se pisa: `qr_destinos_historico`
--     guarda a dónde apuntó cada QR y desde cuándo. Si un cliente se queja de que
--     "el QR llevaba a otro sitio", hay registro.
--   · Los escaneos se cuentan, pero SIN rastrear a la persona: solo día, total y
--     tipo de aparato. Ni IP, ni identificador de móvil, ni nada que señale a un
--     cliente concreto.
--
-- Idempotente: se puede aplicar dos veces sin efecto.

-- 1. Códigos QR ─────────────────────────────────────────────────────────────
create table if not exists public.qr_codigos (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,

  -- El código que viaja DENTRO del QR impreso: `qr.balleshosteleros.com/<codigo>`.
  -- Corto a propósito: menos caracteres = cuadros más grandes = escanea mejor con
  -- mala luz, que en un restaurante de noche es la norma. Único en TODO el sistema.
  codigo        text not null,

  -- Nombre para humanos ("Bacanal — Carta", "Habana — Reseñas"). Vive aquí y NO
  -- dentro del código a propósito: identificar el QR es cosa del panel, no del
  -- papel, y meterlo en la URL solo lo haría más denso y peor de escanear.
  nombre        text not null,
  descripcion   text,

  -- A dónde redirige AHORA MISMO. Se cambia sin tocar el papel: ese es el punto.
  destino       text not null,

  -- Inactivo = el QR existe pero no redirige (muestra un aviso). Sirve para retirar
  -- un QR sin borrarlo: el código sigue quemado y la trazabilidad se conserva.
  estado        text not null default 'ACTIVO',

  -- Contador rápido para la lista. El detalle por día vive en `qr_escaneos`.
  escaneos      bigint not null default 0,
  ultimo_escaneo_at timestamptz,

  creado_por    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint qr_codigos_codigo_key unique (codigo),
  constraint qr_codigos_estado_chk check (estado in ('ACTIVO', 'INACTIVO')),
  -- Alfabeto sin caracteres ambiguos y longitud acotada: el código a veces se teclea
  -- a mano cuando la cámara falla, y 0/O o 1/l/I se confunden al leerlos.
  constraint qr_codigos_codigo_formato_chk check (codigo ~ '^[23456789abcdefghjkmnpqrstuvwxyz]{4,16}$'),
  constraint qr_codigos_destino_chk check (destino ~* '^https?://')
);

create index if not exists idx_qr_codigos_empresa
  on public.qr_codigos (empresa_id, created_at desc);
-- La ruta pública busca por código en cada escaneo: es la consulta más caliente.
create index if not exists idx_qr_codigos_lookup
  on public.qr_codigos (codigo)
  where estado = 'ACTIVO';

-- 2. Códigos quemados ───────────────────────────────────────────────────────
-- Sin `empresa_id` A PROPÓSITO: la reserva es global. Un código quemado por
-- cualquier empresa no vuelve a asignarse a ninguna otra, nunca.
create table if not exists public.qr_codigos_quemados (
  codigo      text primary key,
  motivo      text,
  created_at  timestamptz not null default now()
);

comment on table public.qr_codigos_quemados is
  'Códigos retirados que NO pueden reutilizarse jamás. Si se reciclara un código, '
  'un papel impreso antiguo llevaría a los clientes al sitio equivocado.';

-- 3. Histórico de destinos ──────────────────────────────────────────────────
create table if not exists public.qr_destinos_historico (
  id           uuid primary key default gen_random_uuid(),
  qr_id        uuid not null references public.qr_codigos(id) on delete cascade,
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  destino      text not null,
  cambiado_por uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_qr_destinos_hist_qr
  on public.qr_destinos_historico (qr_id, created_at desc);

-- 4. Escaneos por día ───────────────────────────────────────────────────────
-- Agregado por día y tipo de aparato. NO se guarda IP ni identificador de persona:
-- interesa "cuánta gente escanea la carta los sábados", no quién.
create table if not exists public.qr_escaneos (
  id          uuid primary key default gen_random_uuid(),
  qr_id       uuid not null references public.qr_codigos(id) on delete cascade,
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  fecha       date not null,
  dispositivo text not null default 'otro',
  total       bigint not null default 0,

  constraint qr_escaneos_unq unique (qr_id, fecha, dispositivo),
  constraint qr_escaneos_dispositivo_chk check (dispositivo in ('movil', 'tablet', 'escritorio', 'otro'))
);

create index if not exists idx_qr_escaneos_empresa_fecha
  on public.qr_escaneos (empresa_id, fecha desc);

-- 5. RLS ────────────────────────────────────────────────────────────────────
alter table public.qr_codigos             enable row level security;
alter table public.qr_codigos_quemados    enable row level security;
alter table public.qr_destinos_historico  enable row level security;
alter table public.qr_escaneos            enable row level security;

drop policy if exists "qr_codigos_select" on public.qr_codigos;
drop policy if exists "qr_codigos_insert" on public.qr_codigos;
drop policy if exists "qr_codigos_update" on public.qr_codigos;
drop policy if exists "qr_codigos_delete" on public.qr_codigos;

create policy "qr_codigos_select" on public.qr_codigos
  for select to authenticated
  using (empresa_id in (select empresas_del_usuario()));

create policy "qr_codigos_insert" on public.qr_codigos
  for insert to authenticated
  with check (empresa_id in (select empresas_del_usuario()));

create policy "qr_codigos_update" on public.qr_codigos
  for update to authenticated
  using (empresa_id in (select empresas_del_usuario()));

create policy "qr_codigos_delete" on public.qr_codigos
  for delete to authenticated
  using (empresa_id in (select empresas_del_usuario()));

drop policy if exists "qr_destinos_hist_select" on public.qr_destinos_historico;
create policy "qr_destinos_hist_select" on public.qr_destinos_historico
  for select to authenticated
  using (empresa_id in (select empresas_del_usuario()));

drop policy if exists "qr_escaneos_select" on public.qr_escaneos;
create policy "qr_escaneos_select" on public.qr_escaneos
  for select to authenticated
  using (empresa_id in (select empresas_del_usuario()));

-- `qr_codigos_quemados` se queda SIN políticas a propósito: nadie la lee ni la
-- escribe desde el navegador. Solo la tocan las funciones de abajo (security
-- definer) y el servidor con la service-role. Igual para los INSERT de escaneos e
-- histórico: los hace el servidor, no el cliente.

-- 6. Reserva de código libre ────────────────────────────────────────────────
-- Comprueba código libre + lo quema en UNA sola operación atómica. Hacerlo en dos
-- pasos desde la aplicación abriría una ventana en la que dos empresas creando un
-- QR a la vez podrían llevarse el mismo código.
create or replace function public.qr_reservar_codigo(p_codigo text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_codigo !~ '^[23456789abcdefghjkmnpqrstuvwxyz]{4,16}$' then
    return false;
  end if;

  -- Si ya estuvo quemado alguna vez, no se entrega jamás.
  insert into public.qr_codigos_quemados (codigo, motivo)
  values (p_codigo, 'reservado')
  on conflict (codigo) do nothing;

  if not found then
    return false;
  end if;

  -- Cinturón y tirantes: un código vivo tampoco se entrega, aunque por alguna vía
  -- rara no constara como quemado.
  if exists (select 1 from public.qr_codigos where codigo = p_codigo) then
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.qr_reservar_codigo(text) from public;
grant execute on function public.qr_reservar_codigo(text) to service_role;

-- 7. Registro de escaneo ────────────────────────────────────────────────────
-- Suma en el contador rápido y en el desglose diario de una vez. `security definer`
-- porque quien escanea es un cliente anónimo sin cuenta en el sistema.
create or replace function public.qr_registrar_escaneo(
  p_qr_id uuid,
  p_dispositivo text default 'otro',
  p_fecha date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_disp    text;
begin
  select empresa_id into v_empresa from public.qr_codigos where id = p_qr_id;
  if v_empresa is null then
    return;
  end if;

  v_disp := case when p_dispositivo in ('movil', 'tablet', 'escritorio') then p_dispositivo else 'otro' end;

  update public.qr_codigos
     set escaneos = escaneos + 1,
         ultimo_escaneo_at = now()
   where id = p_qr_id;

  insert into public.qr_escaneos (qr_id, empresa_id, fecha, dispositivo, total)
  values (p_qr_id, v_empresa, p_fecha, v_disp, 1)
  on conflict (qr_id, fecha, dispositivo)
  do update set total = public.qr_escaneos.total + 1;
end;
$$;

revoke all on function public.qr_registrar_escaneo(uuid, text, date) from public;
grant execute on function public.qr_registrar_escaneo(uuid, text, date) to service_role;

-- 8. Quemar al borrar ───────────────────────────────────────────────────────
-- El código se marca como quemado ANTES de que la fila desaparezca, para que no
-- pueda volver a asignarse aunque el QR se borre del panel.
create or replace function public.qr_quemar_al_borrar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.qr_codigos_quemados (codigo, motivo)
  values (old.codigo, 'borrado')
  on conflict (codigo) do nothing;
  return old;
end;
$$;

drop trigger if exists trg_qr_quemar_al_borrar on public.qr_codigos;
create trigger trg_qr_quemar_al_borrar
  before delete on public.qr_codigos
  for each row execute function public.qr_quemar_al_borrar();

-- 9. updated_at ─────────────────────────────────────────────────────────────
create or replace function public.qr_codigos_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_qr_codigos_touch on public.qr_codigos;
create trigger trg_qr_codigos_touch
  before update on public.qr_codigos
  for each row execute function public.qr_codigos_touch();

comment on table public.qr_codigos is
  'Códigos QR con redirección propia. El QR impreso apunta a un dominio nuestro, '
  'nunca al destino final: así el destino se cambia sin reimprimir las cartas.';
comment on column public.qr_codigos.codigo is
  'Código corto único en TODO el sistema (el dominio es común a todas las empresas).';
comment on column public.qr_codigos.destino is
  'A dónde redirige ahora. Cambiarlo NO invalida el papel ya impreso.';
comment on column public.qr_codigos.nombre is
  'Etiqueta para el panel. Deliberadamente fuera de la URL: alargarla haría el QR '
  'más denso y peor de escanear con poca luz.';
