-- ============================================================================
-- Videovigilancia cloud: grabaciones de cámaras en Cloudflare R2
-- ----------------------------------------------------------------------------
-- Modelo "todo online, sin hardware nuestro": el grabador (NVR) del cliente
-- —o una cámara con subida S3 nativa— empuja clips MP4 a NUESTRO bucket R2.
-- El software recibe cada clip, lo guarda en R2 y registra aquí su metadato.
-- Retención rodante de 30 días SOLO para cámaras (cron aparte borra R2 + fila).
--
-- Esta migración:
--   1) Versiona la tabla `camaras` (su CREATE no estaba en el repo, solo ALTERs).
--   2) Reafirma de forma idempotente las columnas de PRP-061 (conector/stream).
--   3) Crea `camara_grabaciones` (un clip = una fila) con RLS multi-tenant.
--   4) Amplía la cuota por empresa para que los clips de cámara también cuenten.
--
-- Idempotente: re-ejecutable sin error.
-- ============================================================================

-- 1) Tabla base de cámaras (idempotente; refleja el esquema ya vivo en la BD)
create table if not exists public.camaras (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  local_id       uuid references public.locales(id),
  nombre         text not null,
  ubicacion      text,
  canal          integer,
  stream_subtipo integer not null default 0,
  orden          integer not null default 0,
  activo         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid
);

-- 2) Columnas de PRP-061 (vínculo al conector + datos de stream, sin credenciales)
alter table public.camaras add column if not exists conector_id uuid references public.conectores(id) on delete set null;
alter table public.camaras add column if not exists onvif_uid text;
alter table public.camaras add column if not exists rtsp_path text;
alter table public.camaras add column if not exists soporta_rebobinado boolean not null default false;
alter table public.camaras add column if not exists grabacion_cloud boolean not null default false;

create index if not exists idx_camaras_empresa on public.camaras(empresa_id);
create index if not exists idx_camaras_conector on public.camaras(conector_id);

-- updated_at automático (misma función compartida del proyecto)
drop trigger if exists trg_camaras_updated_at on public.camaras;
create trigger trg_camaras_updated_at
  before update on public.camaras
  for each row execute function set_updated_at();

-- RLS multi-tenant (patrón estándar: empresas_del_usuario())
alter table public.camaras enable row level security;

drop policy if exists camaras_select on public.camaras;
create policy camaras_select on public.camaras
  for select using (empresa_id in (select empresas_del_usuario()));

drop policy if exists camaras_insert on public.camaras;
create policy camaras_insert on public.camaras
  for insert with check (empresa_id in (select empresas_del_usuario()));

drop policy if exists camaras_update on public.camaras;
create policy camaras_update on public.camaras
  for update using (empresa_id in (select empresas_del_usuario()))
  with check (empresa_id in (select empresas_del_usuario()));

drop policy if exists camaras_delete on public.camaras;
create policy camaras_delete on public.camaras
  for delete using (empresa_id in (select empresas_del_usuario()));

-- 3) Grabaciones de cámara: un clip (segmento de vídeo) = una fila.
--    Los bytes viven en R2 (`r2_key`); aquí solo el metadato + tamaño.
create table if not exists public.camara_grabaciones (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  camara_id    uuid not null references public.camaras(id) on delete cascade,
  conector_id  uuid references public.conectores(id) on delete set null,
  r2_key       text not null,
  url          text,
  -- Ventana temporal que cubre el clip (para rebobinar por fecha/hora).
  inicio       timestamptz not null,
  fin          timestamptz not null,
  duracion_seg integer not null default 0,
  file_size    bigint not null default 0,
  mime_type    text not null default 'video/mp4',
  created_at   timestamptz not null default now()
);

-- Un mismo objeto R2 no puede registrarse dos veces (subidas reintentadas).
create unique index if not exists uq_camara_grabaciones_r2_key on public.camara_grabaciones(r2_key);
-- Consulta típica del visor: clips de una cámara por rango de tiempo.
create index if not exists idx_camara_grabaciones_camara_inicio
  on public.camara_grabaciones(camara_id, inicio desc);
-- Barrido del cron de retención por antigüedad dentro de cada empresa.
create index if not exists idx_camara_grabaciones_empresa_inicio
  on public.camara_grabaciones(empresa_id, inicio);

comment on table public.camara_grabaciones is
  'Clips de vídeo de cámaras subidos a Cloudflare R2 por el grabador/cámara del local. Retención rodante de 30 días (cron). Los bytes viven en R2; esta tabla solo registra metadatos + tamaño para cuota.';

-- RLS: los usuarios de la empresa ven/gestionan sus clips. La ingesta desde el
-- grabador entra por endpoint con service role (device_token), no por sesión.
alter table public.camara_grabaciones enable row level security;

drop policy if exists camara_grabaciones_select on public.camara_grabaciones;
create policy camara_grabaciones_select on public.camara_grabaciones
  for select using (empresa_id in (select empresas_del_usuario()));

drop policy if exists camara_grabaciones_delete on public.camara_grabaciones;
create policy camara_grabaciones_delete on public.camara_grabaciones
  for delete using (empresa_id in (select empresas_del_usuario()));

-- 4) Cuota por empresa: los clips de cámara TAMBIÉN ocupan almacenamiento.
--    Redefinimos la vista para sumar recordings + camara_grabaciones, así el
--    límite de 500 GB/empresa incluye ya el vídeo de videovigilancia.
create or replace view public.storage_usage_por_empresa
with (security_invoker = true) as
select
  e.id                                                    as empresa_id,
  e.nombre                                                as empresa_nombre,
  (coalesce(r.bytes, 0) + coalesce(c.bytes, 0))::bigint   as bytes_used,
  e.storage_limit_bytes                                   as bytes_limit,
  (coalesce(r.files, 0) + coalesce(c.files, 0))::integer  as files_count
from public.empresas e
left join (
  select empresa_id, sum(file_size) as bytes, count(id) as files
  from public.recordings group by empresa_id
) r on r.empresa_id = e.id
left join (
  select empresa_id, sum(file_size) as bytes, count(id) as files
  from public.camara_grabaciones group by empresa_id
) c on c.empresa_id = e.id;

comment on view public.storage_usage_por_empresa is
  'Uso de almacenamiento por empresa: suma grabaciones de pantalla/formación (recordings) + clips de cámara (camara_grabaciones), frente al límite de la empresa. Los archivos viven en R2; la vista solo agrega tamaños.';
