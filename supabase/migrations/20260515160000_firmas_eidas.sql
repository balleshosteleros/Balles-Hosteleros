-- ============================================================
-- PRP-036 — Firmas electrónicas con validez legal eIDAS
-- Tablas: firmas_documentos, firmas_tokens, firmas_otps, firmas_eventos
-- Bucket: firmas (privado)
-- ============================================================

-- pgcrypto ya está instalada en el proyecto (verificado).

-- ─── 1. Documentos a firmar ──────────────────────────────────
create table if not exists public.firmas_documentos (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  empleado_id       uuid not null references public.empleados(id) on delete restrict,
  titulo            text not null,
  tipo              text not null,
  modalidad         text not null
                    check (modalidad in ('click_to_sign','email_otp','manuscrita_digital')),
  validez           text not null default 'eidas_simple'
                    check (validez in ('eidas_simple','eidas_avanzada','eidas_cualificada')),
  estado            text not null default 'pendiente'
                    check (estado in ('borrador','pendiente','firmado','rechazado','expirado')),
  pdf_original_path text not null,
  pdf_firmado_path  text,
  sha256_original   text not null,
  sha256_acta       text,
  firmado_en        timestamptz,
  ip_firma          inet,
  user_agent        text,
  metodo_firma      text,
  motivo_rechazo    text,
  enviado_por       uuid not null references auth.users(id) on delete restrict,
  enviado_en        timestamptz not null default now(),
  expira_en         timestamptz not null,
  observaciones     text,
  reenviado_count   integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_firmas_doc_empresa  on public.firmas_documentos(empresa_id, estado);
create index if not exists idx_firmas_doc_empleado on public.firmas_documentos(empleado_id);
create index if not exists idx_firmas_doc_expira   on public.firmas_documentos(expira_en) where estado = 'pendiente';

-- ─── 2. Tokens de acceso público (single-use) ───────────────
create table if not exists public.firmas_tokens (
  id           uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.firmas_documentos(id) on delete cascade,
  token_hash   text not null,
  expira_en    timestamptz not null,
  consumido_en timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_firmas_tokens_doc on public.firmas_tokens(documento_id);
create index if not exists idx_firmas_tokens_hash on public.firmas_tokens(token_hash);

-- ─── 3. OTPs (2º factor) ────────────────────────────────────
create table if not exists public.firmas_otps (
  id              uuid primary key default gen_random_uuid(),
  documento_id    uuid not null references public.firmas_documentos(id) on delete cascade,
  codigo_hash     text not null,
  canal           text not null check (canal in ('email','sms')),
  destino         text not null,
  expira_en       timestamptz not null,
  intentos        integer not null default 0,
  validado_en     timestamptz,
  bloqueado_hasta timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_firmas_otps_doc on public.firmas_otps(documento_id, created_at desc);

-- ─── 4. Audit trail con hash chain (inmutable) ─────────────
create table if not exists public.firmas_eventos (
  id            uuid primary key default gen_random_uuid(),
  documento_id  uuid not null references public.firmas_documentos(id) on delete cascade,
  tipo          text not null check (tipo in (
                  'creado','enviado','reenviado','abierto','otp_enviado','otp_validado',
                  'otp_fallido','otp_bloqueado','firmado','rechazado','expirado'
                )),
  actor_user_id uuid references auth.users(id) on delete set null,
  ip            inet,
  user_agent    text,
  metadata      jsonb not null default '{}'::jsonb,
  prev_hash     text,
  hash          text not null,
  ocurrido_en   timestamptz not null default now()
);

create index if not exists idx_firmas_eventos_doc on public.firmas_eventos(documento_id, ocurrido_en);

-- Inmutabilidad de eventos: bloquear UPDATE y DELETE a nivel de trigger.
create or replace function public.firmas_eventos_block_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'firmas_eventos es append-only: % no permitido', tg_op;
end;
$$;

drop trigger if exists firmas_eventos_no_update on public.firmas_eventos;
create trigger firmas_eventos_no_update
  before update on public.firmas_eventos
  for each row execute function public.firmas_eventos_block_mutation();

drop trigger if exists firmas_eventos_no_delete on public.firmas_eventos;
create trigger firmas_eventos_no_delete
  before delete on public.firmas_eventos
  for each row execute function public.firmas_eventos_block_mutation();

-- ─── 5. Trigger updated_at en firmas_documentos ────────────
create or replace function public.firmas_documentos_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists firmas_documentos_touch on public.firmas_documentos;
create trigger firmas_documentos_touch
  before update on public.firmas_documentos
  for each row execute function public.firmas_documentos_set_updated_at();

-- ─── 6. RLS ────────────────────────────────────────────────
alter table public.firmas_documentos enable row level security;
alter table public.firmas_tokens     enable row level security;
alter table public.firmas_otps       enable row level security;
alter table public.firmas_eventos    enable row level security;

-- ── 6.1 firmas_documentos ──
-- Lectura: empresa propietaria (profiles o user_empresas) o empleado firmante
create policy "fd_select_empresa" on public.firmas_documentos for select to authenticated
  using (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
    or empresa_id in (select ue.empresa_id from public.user_empresas ue where ue.user_id = auth.uid())
  );

create policy "fd_select_empleado" on public.firmas_documentos for select to authenticated
  using (
    empleado_id in (select e.id from public.empleados e where e.user_id = auth.uid())
  );

-- Escritura: admin/director de la empresa propietaria
create policy "fd_manage_admin" on public.firmas_documentos for all to authenticated
  using (
    (
      empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
      or empresa_id in (select ue.empresa_id from public.user_empresas ue where ue.user_id = auth.uid())
    )
    and exists (
      select 1 from public.user_roles r
      where r.user_id = auth.uid() and r.role::text in ('admin','director')
    )
  )
  with check (
    (
      empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
      or empresa_id in (select ue.empresa_id from public.user_empresas ue where ue.user_id = auth.uid())
    )
    and exists (
      select 1 from public.user_roles r
      where r.user_id = auth.uid() and r.role::text in ('admin','director')
    )
  );

-- ── 6.2 firmas_tokens: deny-by-default a clientes (acceso vía service_role server-side)
create policy "ft_deny_select" on public.firmas_tokens for select to authenticated using (false);

-- ── 6.3 firmas_otps: deny-by-default
create policy "fo_deny_select" on public.firmas_otps for select to authenticated using (false);

-- ── 6.4 firmas_eventos: misma lectura que documento; nadie inserta/upd/del en cliente
create policy "fe_select_empresa" on public.firmas_eventos for select to authenticated
  using (
    documento_id in (
      select d.id from public.firmas_documentos d
      where d.empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
         or d.empresa_id in (select ue.empresa_id from public.user_empresas ue where ue.user_id = auth.uid())
    )
  );

create policy "fe_select_empleado" on public.firmas_eventos for select to authenticated
  using (
    documento_id in (
      select d.id from public.firmas_documentos d
      where d.empleado_id in (select e.id from public.empleados e where e.user_id = auth.uid())
    )
  );

-- INSERT/UPDATE/DELETE de eventos: solo service_role (sin policy explícita para authenticated).
-- Los triggers `firmas_eventos_no_update`/`firmas_eventos_no_delete` bloquean además a service_role.

-- ─── 7. Bucket Storage ─────────────────────────────────────
-- Crear bucket privado 'firmas' si no existe
insert into storage.buckets (id, name, public)
values ('firmas', 'firmas', false)
on conflict (id) do nothing;

-- Acceso al bucket: solo service_role (todas las operaciones de cliente van por signed URL).
-- No creamos policies para authenticated → bloqueado por defecto (RLS de storage.objects).
-- Si en el futuro se quiere lectura directa para el firmante autenticado, se añade aquí.
