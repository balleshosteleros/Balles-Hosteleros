-- Migration 003: FAQs table for the in-app Ayuda center (PRP-023, Fase 2)
-- - Stores FAQ content editable from the software itself (no markdown files)
-- - Each FAQ is visible to one or more roles (app_role[])
-- - Admin/director can CRUD; everyone else can only read visible ones
-- This migration is additive and idempotent.

-- =======================================================
-- 1. faqs table
-- =======================================================
create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  categoria text not null,
  pregunta text not null,
  respuesta text not null,
  visible_para public.app_role[] not null default array['admin','director','gerencia','responsable','empleado','solo_lectura']::public.app_role[],
  orden int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_faqs_categoria on public.faqs(categoria);
create index if not exists idx_faqs_orden on public.faqs(categoria, orden);

-- =======================================================
-- 2. Trigger: auto-actualizar updated_at
-- =======================================================
create or replace function public.set_faqs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists faqs_updated_at on public.faqs;
create trigger faqs_updated_at
  before update on public.faqs
  for each row
  execute function public.set_faqs_updated_at();

-- =======================================================
-- 3. RLS
-- =======================================================
alter table public.faqs enable row level security;

-- Helper: check if current user has any of the given roles
create or replace function public.current_user_has_role(check_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = any(check_roles)
  );
$$;

-- SELECT: usuarios autenticados ven FAQs cuya lista visible_para
--          intersecciona con cualquiera de SUS roles
drop policy if exists "Users see FAQs visible to their role" on public.faqs;
create policy "Users see FAQs visible to their role"
  on public.faqs for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = any(public.faqs.visible_para)
    )
  );

-- INSERT/UPDATE/DELETE: solo admin o director
drop policy if exists "Admin and director can insert FAQs" on public.faqs;
create policy "Admin and director can insert FAQs"
  on public.faqs for insert
  to authenticated
  with check (
    public.current_user_has_role(array['admin','director']::public.app_role[])
  );

drop policy if exists "Admin and director can update FAQs" on public.faqs;
create policy "Admin and director can update FAQs"
  on public.faqs for update
  to authenticated
  using (
    public.current_user_has_role(array['admin','director']::public.app_role[])
  )
  with check (
    public.current_user_has_role(array['admin','director']::public.app_role[])
  );

drop policy if exists "Admin and director can delete FAQs" on public.faqs;
create policy "Admin and director can delete FAQs"
  on public.faqs for delete
  to authenticated
  using (
    public.current_user_has_role(array['admin','director']::public.app_role[])
  );

-- =======================================================
-- 4. Seed: algunas FAQs de ejemplo para que la UI no arranque vacía
-- =======================================================
insert into public.faqs (categoria, pregunta, respuesta, visible_para, orden)
values
  (
    'General',
    '¿Cómo cambio mi contraseña?',
    'Ve a **Ajustes → Mi perfil → Cambiar contraseña**. Te enviaremos un correo de confirmación para validar el cambio.',
    array['admin','director','gerencia','responsable','empleado','solo_lectura']::public.app_role[],
    1
  ),
  (
    'General',
    '¿Puedo acceder desde el móvil?',
    'Sí. La aplicación es responsive y funciona en cualquier navegador móvil. Te recomendamos usar Chrome o Safari en tu teléfono.',
    array['admin','director','gerencia','responsable','empleado','solo_lectura']::public.app_role[],
    2
  ),
  (
    'RRHH',
    '¿Cómo registro un fichaje?',
    'Entra en **RECURSOS HUMANOS → FICHAJES** y pulsa el botón "Fichar entrada" o "Fichar salida". El sistema registra la hora automáticamente.',
    array['admin','director','gerencia','responsable','empleado']::public.app_role[],
    1
  ),
  (
    'Dirección',
    '¿Cómo veo las métricas de apertura del restaurante?',
    'Entra en **DIRECCIÓN → APERTURAS** y selecciona el rango de fechas. Verás ingresos, tickets, ticket medio y comparativas.',
    array['admin','director','gerencia']::public.app_role[],
    1
  ),
  (
    'Logística',
    '¿Cómo añado un proveedor nuevo?',
    'Ve a **LOGÍSTICA → PROVEEDORES** y pulsa "Nuevo proveedor". Rellena los datos fiscales y de contacto. Solo los roles de gerencia pueden añadir proveedores.',
    array['admin','director','gerencia']::public.app_role[],
    1
  )
on conflict do nothing;
