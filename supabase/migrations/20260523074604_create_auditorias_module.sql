-- ============ Módulo Auditorías (Calidad) ============
--
-- Esta migración estaba APLICADA en Supabase pero no existía como archivo en el
-- repo: se creó directamente contra la base de datos. Se versiona aquí para que
-- el módulo sea reproducible desde cero. Es idempotente y refleja el estado
-- ACTUAL de la BD (RLS ya migrada a empresas_del_usuario(), no al antiguo
-- profiles.empresa_id del SQL original).
--
-- Modelo: una PLANTILLA raíz -> N VERSIONES (borrador/publicada, una vigente)
--         -> SECCIONES -> PREGUNTAS. Los ENVÍOS congelan la version_id usada.

-- 1) Plantillas raíz
create table if not exists public.auditoria_plantillas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  numero_secuencial int,
  nombre text not null,
  descripcion text,
  clonada_de_plantilla_id uuid references public.auditoria_plantillas(id),
  archivada boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (empresa_id, numero_secuencial)
);

-- 2) Versiones
create table if not exists public.auditoria_plantilla_versiones (
  id uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references public.auditoria_plantillas(id) on delete cascade,
  version int not null,
  estado text not null check (estado in ('borrador','publicada')),
  vigente boolean not null default false,
  publicada_at timestamptz,
  publicada_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (plantilla_id, version)
);
create unique index if not exists auditoria_plantilla_una_vigente
  on public.auditoria_plantilla_versiones (plantilla_id) where vigente;

-- 3) Secciones
create table if not exists public.auditoria_secciones (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.auditoria_plantilla_versiones(id) on delete cascade,
  orden int not null,
  titulo text not null,
  descripcion text
);
create index if not exists auditoria_secciones_version_idx
  on public.auditoria_secciones(version_id, orden);

-- 4) Preguntas
create table if not exists public.auditoria_preguntas (
  id uuid primary key default gen_random_uuid(),
  seccion_id uuid not null references public.auditoria_secciones(id) on delete cascade,
  orden int not null,
  numero_global int not null,
  tipo text not null check (tipo in ('escala','texto_largo','si_no','opcion_unica','opcion_multiple','observaciones')),
  texto text not null,
  obligatoria boolean not null default false,
  peso numeric(6,2) not null default 1,
  escala_min int default 0,
  escala_max int default 5,
  etiqueta_min text default 'Muy mal',
  etiqueta_max text default 'Muy bien',
  opciones jsonb
);
create index if not exists auditoria_preguntas_seccion_idx
  on public.auditoria_preguntas(seccion_id, orden);

-- 5) Envíos (congelan la versión con la que se auditó)
create table if not exists public.auditoria_envios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  numero_secuencial int,
  plantilla_id uuid not null references public.auditoria_plantillas(id),
  version_id uuid not null references public.auditoria_plantilla_versiones(id),
  local_id uuid not null references public.locales(id),
  auditor_empleado_id uuid not null references public.empleados(id),
  fecha date not null default current_date,
  estado text not null check (estado in ('borrador','enviada')) default 'borrador',
  nota_final numeric(4,2),
  enviada_at timestamptz,
  created_at timestamptz not null default now(),
  unique (empresa_id, numero_secuencial)
);
create index if not exists auditoria_envios_empresa_fecha_idx
  on public.auditoria_envios(empresa_id, fecha desc);

-- 6) Respuestas
create table if not exists public.auditoria_respuestas (
  id uuid primary key default gen_random_uuid(),
  envio_id uuid not null references public.auditoria_envios(id) on delete cascade,
  pregunta_id uuid not null references public.auditoria_preguntas(id),
  valor_numero numeric(6,2),
  valor_texto text,
  valor_opciones jsonb,
  unique (envio_id, pregunta_id)
);
create index if not exists auditoria_respuestas_envio_idx
  on public.auditoria_respuestas(envio_id);

-- 7) Marca de empresa
alter table public.empresas
  add column if not exists auditorias_historico_importado boolean default false;

-- 8) Numeración secuencial inmutable (ID visible que no cambia nunca)
drop trigger if exists trg_auditoria_plantillas_numero on public.auditoria_plantillas;
create trigger trg_auditoria_plantillas_numero
  before insert on public.auditoria_plantillas
  for each row execute function public.assign_numero_secuencial();

drop trigger if exists trg_auditoria_plantillas_lock on public.auditoria_plantillas;
create trigger trg_auditoria_plantillas_lock
  before update on public.auditoria_plantillas
  for each row execute function public.lock_numero_secuencial();

drop trigger if exists trg_auditoria_envios_numero on public.auditoria_envios;
create trigger trg_auditoria_envios_numero
  before insert on public.auditoria_envios
  for each row execute function public.assign_numero_secuencial();

drop trigger if exists trg_auditoria_envios_lock on public.auditoria_envios;
create trigger trg_auditoria_envios_lock
  before update on public.auditoria_envios
  for each row execute function public.lock_numero_secuencial();

-- 9) Solo una versión vigente por plantilla
create or replace function public.auditoria_forzar_una_vigente() returns trigger
  language plpgsql security definer set search_path = 'public' as $$
begin
  if NEW.vigente = true then
    update public.auditoria_plantilla_versiones
    set vigente = false
    where plantilla_id = NEW.plantilla_id
      and id <> NEW.id
      and vigente = true;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_auditoria_una_vigente on public.auditoria_plantilla_versiones;
create trigger trg_auditoria_una_vigente
  after insert or update of vigente on public.auditoria_plantilla_versiones
  for each row when (NEW.vigente = true)
  execute function public.auditoria_forzar_una_vigente();

-- 10) RLS — multi-tenant por empresa activa del usuario
alter table public.auditoria_plantillas enable row level security;
alter table public.auditoria_plantilla_versiones enable row level security;
alter table public.auditoria_secciones enable row level security;
alter table public.auditoria_preguntas enable row level security;
alter table public.auditoria_envios enable row level security;
alter table public.auditoria_respuestas enable row level security;

drop policy if exists aud_plantillas_read on public.auditoria_plantillas;
create policy aud_plantillas_read on public.auditoria_plantillas
  for select using (empresa_id in (select public.empresas_del_usuario()));
drop policy if exists aud_plantillas_write on public.auditoria_plantillas;
create policy aud_plantillas_write on public.auditoria_plantillas
  for all using (empresa_id in (select public.empresas_del_usuario()))
  with check (empresa_id in (select public.empresas_del_usuario()));

drop policy if exists aud_versiones_read on public.auditoria_plantilla_versiones;
create policy aud_versiones_read on public.auditoria_plantilla_versiones
  for select using (plantilla_id in (select id from public.auditoria_plantillas));
drop policy if exists aud_versiones_write on public.auditoria_plantilla_versiones;
create policy aud_versiones_write on public.auditoria_plantilla_versiones
  for all using (plantilla_id in (select id from public.auditoria_plantillas))
  with check (plantilla_id in (select id from public.auditoria_plantillas));

drop policy if exists aud_secciones_read on public.auditoria_secciones;
create policy aud_secciones_read on public.auditoria_secciones
  for select using (version_id in (select id from public.auditoria_plantilla_versiones));
drop policy if exists aud_secciones_write on public.auditoria_secciones;
create policy aud_secciones_write on public.auditoria_secciones
  for all using (version_id in (select id from public.auditoria_plantilla_versiones))
  with check (version_id in (select id from public.auditoria_plantilla_versiones));

drop policy if exists aud_preguntas_read on public.auditoria_preguntas;
create policy aud_preguntas_read on public.auditoria_preguntas
  for select using (seccion_id in (select id from public.auditoria_secciones));
drop policy if exists aud_preguntas_write on public.auditoria_preguntas;
create policy aud_preguntas_write on public.auditoria_preguntas
  for all using (seccion_id in (select id from public.auditoria_secciones))
  with check (seccion_id in (select id from public.auditoria_secciones));

drop policy if exists aud_envios_read on public.auditoria_envios;
create policy aud_envios_read on public.auditoria_envios
  for select using (empresa_id in (select public.empresas_del_usuario()));
drop policy if exists aud_envios_write on public.auditoria_envios;
create policy aud_envios_write on public.auditoria_envios
  for all using (empresa_id in (select public.empresas_del_usuario()))
  with check (empresa_id in (select public.empresas_del_usuario()));

drop policy if exists aud_respuestas_read on public.auditoria_respuestas;
create policy aud_respuestas_read on public.auditoria_respuestas
  for select using (envio_id in (select id from public.auditoria_envios));
drop policy if exists aud_respuestas_write on public.auditoria_respuestas;
create policy aud_respuestas_write on public.auditoria_respuestas
  for all using (envio_id in (select id from public.auditoria_envios))
  with check (envio_id in (select id from public.auditoria_envios));
