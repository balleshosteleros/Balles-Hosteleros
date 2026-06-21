-- PRP-061 Fase 1: Conector Balles (videovigilancia agnostica push -> relay cloud)
-- Appliance fisico que el cliente enchufa al router; empuja video de salida a la nube.
-- El almacen sigue en el DVR/NVR del cliente; grabacion cloud = flag opcional de pago.
-- Credenciales RTSP NO van aqui: viven cifradas en el gestor de credenciales (PRP-043).
-- Idempotente: re-ejecutable sin error.

-- 1) Tabla de conectores (appliances)
create table if not exists public.conectores (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  local_id          uuid references public.locales(id),
  nombre            text not null,
  estado            text not null default 'pendiente'
                      check (estado in ('pendiente','emparejado','online','offline','error')),
  -- emparejamiento de un solo uso
  pairing_code      text unique,
  pairing_expira    timestamptz,
  -- credencial del appliance tras emparejar (hash, nunca el secreto en claro)
  device_token_hash text,
  last_seen_at      timestamptz,
  fw_version        text,
  activo            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid
);

create index if not exists idx_conectores_empresa on public.conectores(empresa_id);
create index if not exists idx_conectores_pairing_code on public.conectores(pairing_code);

-- 2) Extender camaras con vinculo al conector y datos de stream (sin credenciales)
alter table public.camaras add column if not exists conector_id uuid references public.conectores(id) on delete set null;
alter table public.camaras add column if not exists onvif_uid text;
alter table public.camaras add column if not exists rtsp_path text;
alter table public.camaras add column if not exists soporta_rebobinado boolean not null default false;
alter table public.camaras add column if not exists grabacion_cloud boolean not null default false;

create index if not exists idx_camaras_conector on public.camaras(conector_id);
-- onvif_uid estable por conector: evita duplicar camaras en re-descubrimiento
create unique index if not exists uq_camaras_conector_onvif on public.camaras(conector_id, onvif_uid)
  where conector_id is not null and onvif_uid is not null;

-- 3) updated_at automatico (misma funcion compartida que camaras)
drop trigger if exists trg_conectores_updated_at on public.conectores;
create trigger trg_conectores_updated_at
  before update on public.conectores
  for each row execute function set_updated_at();

-- 4) RLS multi-tenant (mismo patron que camaras: empresas_del_usuario())
alter table public.conectores enable row level security;

drop policy if exists conectores_select on public.conectores;
create policy conectores_select on public.conectores
  for select using (empresa_id in (select empresas_del_usuario()));

drop policy if exists conectores_insert on public.conectores;
create policy conectores_insert on public.conectores
  for insert with check (empresa_id in (select empresas_del_usuario()));

drop policy if exists conectores_update on public.conectores;
create policy conectores_update on public.conectores
  for update using (empresa_id in (select empresas_del_usuario()))
  with check (empresa_id in (select empresas_del_usuario()));

drop policy if exists conectores_delete on public.conectores;
create policy conectores_delete on public.conectores
  for delete using (empresa_id in (select empresas_del_usuario()));

-- Nota: los endpoints /api/conector/* autentican por device_token del appliance
-- (service role), NO por sesion de usuario -> esa ruta no pasa por estas politicas.
