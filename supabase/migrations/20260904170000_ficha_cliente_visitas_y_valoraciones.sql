-- La ficha del cliente enseña lo que ese cliente ha hecho de verdad.
--
-- Hasta ahora la ficha decía cuántas veces había reservado (un número suelto,
-- `clientes_sala.visitas`) y nada más: ni cuándo vino, ni si se sentó o no
-- apareció, ni qué le pareció. Todo eso vivía en CoverManager.
--
-- Se guarda una fila por reserva que hizo, con su estado real (se sentó,
-- canceló, no apareció...). Cuelga del CLIENTE y no de la reserva: el
-- histórico que llega de CoverManager no tiene reservas en este sistema, y aun
-- así hay que poder verlo. Cuando una reserva de aquí genere una visita, se
-- enlaza por `reserva_id`, que por eso admite nulo.
--
-- Las valoraciones NO se guardan aquí: van a `resenas`, que ya existe y es de
-- donde la ficha las lee.

-- ── Visitas: el historial de reservas del cliente ──────────────────────
create table if not exists public.cliente_visitas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_id uuid not null references public.clientes_sala(id) on delete cascade,
  -- Nulo cuando la visita viene del histórico importado: esa reserva nunca
  -- existió en este sistema. Si la reserva es de aquí y luego se borra, la
  -- visita se queda (pasó de verdad), solo pierde el enlace.
  reserva_id uuid references public.reservas(id) on delete set null,

  fecha date not null,
  hora text,
  turno text,
  personas integer,
  -- Estado tal y como lo contó el origen ("Sentada", "No show", "Cancelado
  -- por el cliente"...). Texto libre a propósito: es un hecho histórico, no
  -- un estado vivo que el software vaya a cambiar.
  estado text,
  mesa text,
  zona text,
  origen text,
  local text,
  observaciones text,
  -- De dónde salió la fila: "covermanager" el histórico, "sistema" lo que
  -- genere esta aplicación. Sirve para poder rehacer una importación sin
  -- tocar lo que creó el software.
  fuente text not null default 'sistema',
  -- Identificador de la reserva en el sistema de origen. Es lo que evita que
  -- reimportar el mismo fichero duplique el historial.
  fuente_ref text,

  created_at timestamptz not null default now()
);

create index if not exists cliente_visitas_cliente_idx
  on public.cliente_visitas (cliente_id, fecha desc);
create index if not exists cliente_visitas_empresa_idx
  on public.cliente_visitas (empresa_id, fecha desc);
-- Una misma reserva del origen no puede entrar dos veces.
create unique index if not exists cliente_visitas_fuente_uidx
  on public.cliente_visitas (empresa_id, fuente, fuente_ref)
  where fuente_ref is not null;

-- ── Resumen en la ficha ────────────────────────────────────────────────
-- Cuántas veces falló el cliente. Vive en la ficha y no escondido en el
-- historial porque es el dato que decide si a alguien se le pide tarjeta.
--
-- Las VALORACIONES no se guardan aquí: ya tienen su sitio en `resenas`, que es
-- de donde las lee la ficha. Crear una segunda tabla habría dejado las notas
-- del cliente en dos lugares distintos.
alter table public.clientes_sala
  add column if not exists no_shows integer not null default 0,
  add column if not exists cancelaciones integer not null default 0,
  add column if not exists primera_visita date;

-- ── RLS: cada empresa ve lo suyo ───────────────────────────────────────
alter table public.cliente_visitas enable row level security;

drop policy if exists cliente_visitas_rw on public.cliente_visitas;
create policy cliente_visitas_rw on public.cliente_visitas
  for all to authenticated
  using (empresa_id in (select empresas_del_usuario()))
  with check (empresa_id in (select empresas_del_usuario()));
