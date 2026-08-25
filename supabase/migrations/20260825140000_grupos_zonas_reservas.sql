-- GRUPOS DE ZONAS: lo que el cliente ve al reservar online.
--
-- Un grupo de zonas agrupa una o varias zonas internas bajo un nombre
-- comercial. Ejemplo: "Sala" = Cuadrado + Redondas + Cristalera.
--
-- Reglas de negocio:
--   - El cliente SOLO puede reservar en zonas de algun grupo. Una zona interna que
--     no pertenezca a ningun grupo no es asignable por web (si por telefono y
--     desde Sala).
--   - Una zona interna pertenece como mucho a UN grupo (evita que una
--     mesa sea alcanzable desde dos opciones distintas del desplegable).
--
-- No se usa `zonas.grupo_zona_id` (auto-referencia preexistente sin uso):
-- obligaria a que el nombre comercial fuese a su vez una zona real con mesas,
-- apareciendo en el plano y en Estructura.

create table if not exists public.grupos_zonas (
  id          uuid primary key default gen_random_uuid(),
  local_id    uuid not null references public.locales(id) on delete cascade,
  nombre      text not null check (length(trim(nombre)) between 1 and 60),
  descripcion text,
  orden       integer not null default 0,
  activa      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.grupos_zonas is
  'Zonas tal y como las ve el cliente en el motor de reservas. Agrupan zonas internas bajo un nombre comercial.';

-- Nombre unico por local: dos opciones iguales en el desplegable no tendrian
-- sentido para el cliente.
create unique index if not exists grupos_zonas_local_nombre_uidx
  on public.grupos_zonas (local_id, lower(trim(nombre)));

create index if not exists grupos_zonas_local_id_idx
  on public.grupos_zonas (local_id);

-- Que zonas internas componen cada grupo.
create table if not exists public.grupo_zona_zonas (
  grupo_zona_id uuid not null references public.grupos_zonas(id) on delete cascade,
  zona_id         uuid not null references public.zonas(id) on delete cascade,
  primary key (grupo_zona_id, zona_id)
);

-- Una zona interna en un solo grupo: si estuviera en dos, el cliente podria
-- llegar a la misma mesa por dos caminos y el aforo se contaria mal.
create unique index if not exists grupo_zona_zonas_zona_uidx
  on public.grupo_zona_zonas (zona_id);

create index if not exists grupo_zona_zonas_grupo_idx
  on public.grupo_zona_zonas (grupo_zona_id);

-- Interruptor por empresa: exigir o no que el cliente elija zona al reservar.
alter table public.empresa_reservas_config
  add column if not exists exigir_zona_cliente boolean not null default false;

comment on column public.empresa_reservas_config.exigir_zona_cliente is
  'Si esta activo, el formulario publico obliga a elegir zona y solo asigna mesas de esa grupo de zonas.';

-- RLS: mismo criterio que el resto de la estructura de sala. Lectura para
-- usuarios de la empresa duena del local; el motor publico entra con la clave
-- de servicio y no pasa por aqui.
alter table public.grupos_zonas enable row level security;
alter table public.grupo_zona_zonas enable row level security;

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

drop policy if exists grupo_zona_zonas_rw on public.grupo_zona_zonas;
create policy grupo_zona_zonas_rw on public.grupo_zona_zonas
  for all
  using (
    exists (
      select 1
      from public.grupos_zonas zp
      join public.locales l on l.id = zp.local_id
      where zp.id = grupo_zona_zonas.grupo_zona_id
        and l.empresa_id in (select empresas_del_usuario())
    )
  )
  with check (
    exists (
      select 1
      from public.grupos_zonas zp
      join public.locales l on l.id = zp.local_id
      where zp.id = grupo_zona_zonas.grupo_zona_id
        and l.empresa_id in (select empresas_del_usuario())
    )
  );
