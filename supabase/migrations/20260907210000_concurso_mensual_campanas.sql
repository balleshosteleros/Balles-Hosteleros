-- ============================================================
-- Concurso mensual de las campañas de email.
--
-- Mecánica: un día al azar del mes sale el correo. Los tres primeros que
-- acierten las cinco preguntas se llevan cena para dos. Nadie sabe qué día
-- llega, y esa es toda la gracia: el correo se abre en cuanto entra.
--
-- Tres tablas:
--   concurso_ediciones      → una por empresa y mes (la de octubre de BACANAL)
--   concurso_preguntas      → las cinco de esa edición, con su respuesta
--   concurso_participaciones→ quién jugó, cuánto acertó y quién ganó
--
-- ── Por qué no hay políticas para el público ───────────────────────────────
-- Las preguntas guardan la RESPUESTA CORRECTA. Si el navegador pudiera leer la
-- tabla, el concurso duraría lo que tarda alguien en abrir la consola. RLS queda
-- activo SIN políticas: nadie llega por PostgREST, ni con sesión ni sin ella.
-- Todo pasa por el servidor, que corrige y solo devuelve el resultado.
--
-- Idempotente: se puede ejecutar dos veces.
-- ============================================================

-- ─── 1. Ediciones ────────────────────────────────────────────
create table if not exists public.concurso_ediciones (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  -- Clave del mes en el calendario de campañas (OCTUBRE_HALLOWEEN).
  clave        text not null,
  mes          smallint not null check (mes between 1 and 12),
  anio         smallint not null,
  premio       text not null default 'una cena para dos',
  -- Cuántos premios hay. Tres, salvo que un mes se decida otra cosa.
  plazas       smallint not null default 3 check (plazas > 0),
  -- La edición NO acepta juego hasta que se abre. Se abre sola al enviar el
  -- correo del mes: si estuviera abierta antes, quien adivinara la URL jugaría
  -- sin haber recibido nada y se llevaría los tres premios antes del envío.
  abierta      boolean not null default false,
  abierta_en   timestamptz,
  cierra_en    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (empresa_id, clave, anio)
);

create index if not exists idx_concurso_ediciones_empresa
  on public.concurso_ediciones (empresa_id, anio, mes);

-- ─── 2. Preguntas ────────────────────────────────────────────
create table if not exists public.concurso_preguntas (
  id           uuid primary key default gen_random_uuid(),
  edicion_id   uuid not null references public.concurso_ediciones(id) on delete cascade,
  orden        smallint not null check (orden between 1 and 20),
  enunciado    text not null,
  -- Opciones en el orden en que se pintan. Array JSON de textos.
  opciones     jsonb not null,
  -- Índice (base 0) de la opción correcta dentro de `opciones`.
  respuesta    smallint not null check (respuesta >= 0),
  created_at   timestamptz not null default now(),
  unique (edicion_id, orden)
);

-- ─── 3. Participaciones ──────────────────────────────────────
create table if not exists public.concurso_participaciones (
  id            uuid primary key default gen_random_uuid(),
  edicion_id    uuid not null references public.concurso_ediciones(id) on delete cascade,
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  -- Si el correo coincide con un cliente de sala, se enlaza. Si no, se guarda
  -- igual: alguien puede jugar con otra dirección y sigue siendo un cliente.
  cliente_id    uuid references public.clientes_sala(id) on delete set null,
  email         text not null,
  nombre        text,
  telefono      text,
  aciertos      smallint not null default 0,
  pleno         boolean not null default false,
  -- 1, 2 o 3 para los premiados; nulo para el resto.
  posicion      smallint,
  codigo_premio text,
  created_at    timestamptz not null default now(),
  -- Un intento por persona y edición: si no, el primero que falle recarga y
  -- prueba las cuatro combinaciones hasta acertar.
  unique (edicion_id, email)
);

create index if not exists idx_concurso_part_edicion
  on public.concurso_participaciones (edicion_id, created_at);

-- Las plazas son excluyentes: no puede haber dos primeros.
create unique index if not exists idx_concurso_part_posicion
  on public.concurso_participaciones (edicion_id, posicion)
  where posicion is not null;

-- ─── 4. Reparto de premios sin carreras ──────────────────────
-- Dos personas que envían el formulario en el mismo instante leerían las dos
-- "van dos ganadores" y se llevarían las dos la plaza 3. El bloqueo por edición
-- serializa solo a los de esa edición durante el reparto: quien llega segundo
-- espera a que el primero tenga su número, y cuenta después.
create or replace function public.concurso_asignar_plaza(
  p_participacion uuid
) returns smallint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_edicion uuid;
  v_plazas  smallint;
  v_dadas   smallint;
  v_pos     smallint;
begin
  select p.edicion_id into v_edicion
  from public.concurso_participaciones p
  where p.id = p_participacion;
  if v_edicion is null then return null; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_edicion::text, 0));

  select e.plazas into v_plazas
  from public.concurso_ediciones e
  where e.id = v_edicion and e.abierta;
  if v_plazas is null then return null; end if;

  select count(*) into v_dadas
  from public.concurso_participaciones p
  where p.edicion_id = v_edicion and p.posicion is not null;

  if v_dadas >= v_plazas then return null; end if;

  v_pos := v_dadas + 1;
  update public.concurso_participaciones
     set posicion = v_pos
   where id = p_participacion and posicion is null;

  return v_pos;
end;
$$;

-- ─── 5. RLS: cerrado a cal y canto ───────────────────────────
alter table public.concurso_ediciones       enable row level security;
alter table public.concurso_preguntas       enable row level security;
alter table public.concurso_participaciones enable row level security;

-- Sin políticas a propósito (ver cabecera). El acceso va por servidor.
revoke all on public.concurso_ediciones       from anon, authenticated;
revoke all on public.concurso_preguntas       from anon, authenticated;
revoke all on public.concurso_participaciones from anon, authenticated;
revoke all on function public.concurso_asignar_plaza(uuid) from anon, authenticated;

-- ─── 6. updated_at ───────────────────────────────────────────
create or replace function public.concurso_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_concurso_ediciones_updated on public.concurso_ediciones;
create trigger trg_concurso_ediciones_updated
  before update on public.concurso_ediciones
  for each row execute function public.concurso_set_updated_at();

comment on table public.concurso_ediciones is
  'Concurso mensual de las campañas de email: una edición por empresa y mes.';
comment on table public.concurso_preguntas is
  'Las cinco preguntas de una edición. Guarda la respuesta correcta: NUNCA exponer al cliente.';
comment on table public.concurso_participaciones is
  'Quién jugó, cuánto acertó y quién se llevó una de las plazas.';
