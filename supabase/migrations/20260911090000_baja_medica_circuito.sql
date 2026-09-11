-- Circuito de la BAJA MEDICA: el enlace con el que la gestoria devuelve el
-- comprobante, y cada cuantos dias se le recuerda si no lo sube.
--
-- Mismo patron que el contrato del alta y los papeles de la baja de contrato:
-- del token solo se guarda su HASH, el enlace caduca, y la gestoria no necesita
-- usuario ni contrasena.
--
-- Idempotente.

-- 1. Enlace de subida del comprobante ───────────────────────────────────────
create table if not exists public.baja_medica_doc_tokens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  -- La solicitud de baja medica a la que pertenece.
  solicitud_id uuid not null references public.solicitudes_personal (id) on delete cascade,
  empleado_id uuid not null references public.empleados (id) on delete cascade,

  -- Solo el hash: el token en claro vive unicamente dentro del correo.
  token_hash text not null unique,

  -- Primer dia de la baja. Da nombre al documento cuando se archiva
  -- ("Comprobante de la baja 10/09/2026"), para que no dependa del nombre del
  -- fichero que suba cada gestoria.
  fecha_inicio date not null,

  expira_en timestamptz not null,

  comprobante_path text,
  comprobante_subido_en timestamptz,

  -- Ultimo recordatorio enviado, para espaciarlos.
  recordatorio_ultimo_en timestamptz,

  created_at timestamptz not null default now()
);

-- Una baja medica tiene un unico enlace vivo.
create unique index if not exists idx_baja_medica_token_solicitud
  on public.baja_medica_doc_tokens (solicitud_id);

-- El barrido del recordatorio: los que siguen sin comprobante.
create index if not exists idx_baja_medica_token_pendientes
  on public.baja_medica_doc_tokens (empresa_id, comprobante_subido_en)
  where comprobante_subido_en is null;

alter table public.baja_medica_doc_tokens enable row level security;

drop policy if exists "baja_medica_tokens_select" on public.baja_medica_doc_tokens;

-- Solo lectura, y solo de la propia empresa: quien escribe es el servidor.
-- La pantalla publica de la gestoria resuelve el token con service role.
create policy "baja_medica_tokens_select" on public.baja_medica_doc_tokens
  for select to authenticated
  using (empresa_id in (select empresas_del_usuario()));

comment on table public.baja_medica_doc_tokens is
  'Enlace unico por baja medica para que la gestoria suba el comprobante de haberla tramitado. Del token solo se guarda el hash.';

-- 2. Cada cuantos dias se recuerda ──────────────────────────────────────────
--
-- Se configura en Ajustes -> Solicitudes. 0 = no recordar.
alter table public.empresa_rrhh_config
  add column if not exists baja_medica_recordatorio_dias integer not null default 3;

alter table public.empresa_rrhh_config
  drop constraint if exists empresa_rrhh_config_baja_medica_recordatorio_dias_check;

alter table public.empresa_rrhh_config
  add constraint empresa_rrhh_config_baja_medica_recordatorio_dias_check
  check (baja_medica_recordatorio_dias between 0 and 90);

comment on column public.empresa_rrhh_config.baja_medica_recordatorio_dias is
  'Cada cuantos dias se recuerda a la gestoria el comprobante de una baja medica sin subir. 0 = no recordar.';
