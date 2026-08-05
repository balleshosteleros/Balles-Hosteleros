-- PRP-075 · Fases 1-2-3bis — Separar ENLACES y SECRETOS en dos tablas.
--
--   aplicaciones  → el enlace. Poco sensible: lo lee la empresa.
--   credenciales  → el secreto. RLS estricta con los DOS ESCUDOS de Ivan:
--       Escudo 1: el rol necesita el candado HERR_ACCESOS (Ajustes > Roles).
--       Escudo 2: ademas, su rol debe estar marcado DENTRO de esa credencial.
--                 Si no lo esta, la fila NO se devuelve (ni su usuario).
--
-- El valor cifrado se COPIA TAL CUAL (AES-256-GCM, misma clave): no se descifra
-- en ningun momento, asi que es imposible corromper un secreto al migrar.
--
-- accesos_apps NO se toca ni se borra: queda intacta como red de seguridad.
-- Idempotente: se puede ejecutar varias veces sin duplicar datos.

-- =========================================================================
-- FASE 1 — Tablas
-- =========================================================================

create table if not exists public.aplicaciones (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  origen_id      text,                       -- id en accesos_apps (trazabilidad)
  nombre         text not null,
  descripcion    text not null default '',
  url            text not null default '',
  icono          text not null default '',
  logo_url       text,
  categoria      text not null default 'Otros',
  departamentos  text[] not null default '{}',
  estado         text not null default 'Activo',
  responsable    text not null default '',
  notas          text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.credenciales (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  -- NULLABLE a proposito: los secretos sin enlace (caja fuerte, PIN de TPV,
  -- wifi, SIM...) no cuelgan de ninguna aplicacion. Es su sitio natural.
  aplicacion_id  uuid references public.aplicaciones(id) on delete cascade,
  origen_id      text,
  origen_indice  int,                        -- posicion original en el jsonb
  etiqueta       text not null default '',
  usuario        text not null default '',
  secreto        text,                       -- AES-256-GCM, copiado tal cual
  datos_extra    jsonb not null default '[]'::jsonb,
  roles          text[] not null default '{}',  -- ESCUDO 2. Vacio = solo direccion
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_aplicaciones_empresa on public.aplicaciones(empresa_id);
create index if not exists idx_credenciales_empresa on public.credenciales(empresa_id);
create index if not exists idx_credenciales_app     on public.credenciales(aplicacion_id);
create index if not exists idx_credenciales_roles   on public.credenciales using gin(roles);

-- Evita duplicar filas si la migracion se repite.
create unique index if not exists uq_aplicaciones_origen
  on public.aplicaciones(origen_id) where origen_id is not null;
create unique index if not exists uq_credenciales_origen
  on public.credenciales(origen_id, origen_indice)
  where origen_id is not null and origen_indice is not null;

-- =========================================================================
-- FASE 2 — Copiar datos (accesos_apps queda intacta)
-- =========================================================================

insert into public.aplicaciones (
  empresa_id, origen_id, nombre, descripcion, url, icono, logo_url,
  categoria, departamentos, estado, responsable, notas
)
select aa.empresa_id, aa.id, aa.nombre, coalesce(aa.descripcion,''),
       coalesce(aa.url,''), coalesce(aa.icono,''), aa.logo_url,
       coalesce(aa.categoria,'Otros'), coalesce(aa.departamentos,'{}'),
       coalesce(aa.estado,'Activo'), coalesce(aa.responsable,''), coalesce(aa.notas,'')
from public.accesos_apps aa
where aa.empresa_id is not null
  and coalesce(nullif(trim(aa.url), ''), '') <> ''   -- solo las que SON aplicaciones
on conflict (origen_id) where origen_id is not null do nothing;

-- Todas las credenciales: las de apps con enlace y las sueltas (sin enlace).
insert into public.credenciales (
  empresa_id, aplicacion_id, origen_id, origen_indice,
  etiqueta, usuario, secreto, datos_extra, roles
)
select
  aa.empresa_id,
  app.id,                                   -- NULL si el origen no tenia enlace
  aa.id,
  (e.ord - 1)::int,                         -- indice 0-based, como en el jsonb
  coalesce(e.acc->>'etiqueta',''),
  coalesce(e.acc->>'usuario',''),
  nullif(e.acc->>'contrasena',''),          -- cifrado, copiado tal cual
  coalesce(e.acc->'datos_extra','[]'::jsonb),
  coalesce(array(select jsonb_array_elements_text(coalesce(e.acc->'roles','[]'::jsonb))), '{}')
from public.accesos_apps aa
cross join lateral jsonb_array_elements(coalesce(aa.accesos,'[]'::jsonb)) with ordinality as e(acc, ord)
left join public.aplicaciones app on app.origen_id = aa.id
where aa.empresa_id is not null
on conflict (origen_id, origen_indice)
  where origen_id is not null and origen_indice is not null do nothing;

-- =========================================================================
-- FASE 3-bis — RLS. Los dos escudos, aplicados por la propia base de datos
-- =========================================================================

-- ¿Es direccion/admin de plataforma? (bypass intencional)
create or replace function public.es_direccion(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(bool_or(r.es_admin_plataforma), false)
  from usuarios u join empresa_roles r on r.id = u.rol_id
  where u.user_id = uid;
$$;

-- ESCUDO 1 — ¿su rol tiene el candado HERR_ACCESOS activado?
create or replace function public.rol_tiene_candado_accesos(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(bool_or((p->>'ver')::boolean), false)
  from usuarios u
  join empresa_roles r on r.id = u.rol_id
  cross join lateral jsonb_array_elements(coalesce(r.permisos,'[]'::jsonb)) p
  where u.user_id = uid and upper(p->>'modulo') = 'HERR_ACCESOS';
$$;

-- Nombre del rol SIN acentos (LOGISTICA, GESTORIA, JURIDICO... comparables).
create or replace function public.rol_normalizado(uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select upper(trim(translate(r.nombre,
           'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
           'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')))
  from usuarios u join empresa_roles r on r.id = u.rol_id
  where u.user_id = uid;
$$;

alter table public.aplicaciones enable row level security;
alter table public.credenciales enable row level security;
-- FORCE: ni el propietario de la tabla se salta las politicas.
alter table public.credenciales force row level security;

drop policy if exists aplicaciones_lectura on public.aplicaciones;
create policy aplicaciones_lectura on public.aplicaciones
for select to authenticated
using (empresa_id in (select empresa_id from usuario_empresas where user_id = auth.uid())
    or empresa_id in (select empresa_id from usuarios where user_id = auth.uid()));

-- Escritura de enlaces: solo direccion (la app ya exige permiso de Ajustes).
drop policy if exists aplicaciones_escritura on public.aplicaciones;
create policy aplicaciones_escritura on public.aplicaciones
for all to authenticated
using (public.es_direccion(auth.uid()))
with check (public.es_direccion(auth.uid()));

-- LECTURA DE SECRETOS — aqui viven los dos escudos.
drop policy if exists credenciales_lectura_por_rol on public.credenciales;
create policy credenciales_lectura_por_rol on public.credenciales
for select to authenticated
using (
  (empresa_id in (select empresa_id from usuario_empresas where user_id = auth.uid())
   or empresa_id in (select empresa_id from usuarios where user_id = auth.uid()))
  and (
    public.es_direccion(auth.uid())                       -- bypass direccion
    or (
      public.rol_tiene_candado_accesos(auth.uid())        -- ESCUDO 1
      and array_length(roles, 1) is not null              -- roles vacio = solo direccion
      and public.rol_normalizado(auth.uid()) = any(
            select upper(trim(translate(x,
              'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
              'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')))
            from unnest(roles) x)                          -- ESCUDO 2
    )
  )
);

-- Escritura de secretos: SOLO direccion.
drop policy if exists credenciales_escritura on public.credenciales;
create policy credenciales_escritura on public.credenciales
for all to authenticated
using (public.es_direccion(auth.uid()))
with check (public.es_direccion(auth.uid()));

-- ---------------------------------------------------------------------------
-- APLICADA A PRODUCCION 2026-08-05. Resultado verificado:
--   · 48 aplicaciones (solo las que tienen enlace real)
--   · 145 credenciales (67 sueltas, sin aplicacion: caja fuerte, PIN, wifi, SIM)
--   · 54 datos extra migrados
--   · 0 secretos que no coincidan con el origen (cifrado copiado intacto)
--   · 0 credenciales sin roles marcados
--
-- Prueba de los dos escudos (simulando la politica por rol):
--   DIRECCION    candado si  -> 77 (BACANAL) / 68 (HABANA)   [bypass]
--   GERENCIA     candado si  ->  9 (BACANAL) /  7 (HABANA)   [escudo 2 filtra]
--   CONTABILIDAD candado NO  ->  0 / 0                        [escudo 1 bloquea]
--   COCINA       candado NO  ->  0 / 0                        [escudo 1 bloquea]
--
-- Cada empresa solo alcanza sus propias filas (aislamiento por empresa_id).
-- Copia de seguridad previa: accesos_apps_backup_20260805 (99 filas).
-- ---------------------------------------------------------------------------
