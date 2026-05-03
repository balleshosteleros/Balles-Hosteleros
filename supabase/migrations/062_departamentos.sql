-- ============================================================
-- 062_departamentos.sql — Departamentos en BD + FK desde empresa_roles
--
-- Objetivo:
--   Mover departamentos de localStorage a BD para que la fuente de
--   verdad sea Supabase y eliminar la divergencia que dejaba roles
--   huérfanos en empresa_roles cuando un departamento se borraba/
--   renombraba en local.
--
-- Cambios:
--   1. Tabla nueva departamentos (uuid id, FK a empresas).
--   2. Columna departamento_id en empresa_roles (nullable, ON DELETE SET NULL).
--   3. RLS por empresa (mismo patrón que empresa_roles).
--   4. Seed de departamentos por defecto para todas las empresas.
--   5. Backfill de departamento_id en empresa_roles según el rol persona.
-- ============================================================

create table if not exists public.departamentos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  nombre          text not null,
  descripcion     text not null default '',
  responsable_id  uuid references public.profiles(id) on delete set null,
  estado          text not null default 'Activo' check (estado in ('Activo','Inactivo')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists departamentos_empresa_nombre_uniq
  on public.departamentos (empresa_id, lower(nombre));

create index if not exists idx_departamentos_empresa
  on public.departamentos (empresa_id);

alter table public.empresa_roles
  add column if not exists departamento_id uuid
  references public.departamentos(id) on delete set null;

create index if not exists idx_empresa_roles_departamento
  on public.empresa_roles (departamento_id);

-- ─── Trigger updated_at ──────────────────────────────────────
create or replace function public.departamentos_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_departamentos_updated on public.departamentos;
create trigger trg_departamentos_updated
  before update on public.departamentos
  for each row execute function public.departamentos_set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────
alter table public.departamentos enable row level security;

drop policy if exists "departamentos_select" on public.departamentos;
create policy "departamentos_select" on public.departamentos
  for select to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

drop policy if exists "departamentos_all" on public.departamentos;
create policy "departamentos_all" on public.departamentos
  for all to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  )
  with check (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

-- ─── Seed de departamentos por defecto para cada empresa ─────
-- Idempotente vía ON CONFLICT (empresa_id, lower(nombre)).
insert into public.departamentos (empresa_id, nombre, descripcion)
select e.id, d.nombre, 'Departamento de ' || initcap(d.nombre)
from public.empresas e
cross join (values
  ('DIRECCIÓN'),
  ('GERENCIA'),
  ('CONTABILIDAD'),
  ('GESTORÍA'),
  ('JURÍDICO'),
  ('RECURSOS HUMANOS'),
  ('LOGÍSTICA'),
  ('MARKETING'),
  ('COCINA'),
  ('SALA'),
  ('CALIDAD')
) as d(nombre)
on conflict (empresa_id, lower(nombre)) do nothing;

-- ─── Backfill departamento_id en empresa_roles ───────────────
-- Mapea el nombre del rol persona al departamento correspondiente.
update public.empresa_roles er
   set departamento_id = d.id
  from public.departamentos d
 where d.empresa_id = er.empresa_id
   and er.departamento_id is null
   and (
     (upper(er.nombre) = 'DIRECTOR'               and upper(d.nombre) = 'DIRECCIÓN')          or
     (upper(er.nombre) = 'GERENTE'                and upper(d.nombre) = 'GERENCIA')           or
     (upper(er.nombre) = 'CONTABLE'               and upper(d.nombre) = 'CONTABILIDAD')       or
     (upper(er.nombre) = 'GESTOR'                 and upper(d.nombre) = 'GESTORÍA')           or
     (upper(er.nombre) = 'ABOGADO'                and upper(d.nombre) = 'JURÍDICO')           or
     (upper(er.nombre) = 'RESPONSABLE RRHH'       and upper(d.nombre) = 'RECURSOS HUMANOS')   or
     (upper(er.nombre) = 'JEFE DE LOGÍSTICA'      and upper(d.nombre) = 'LOGÍSTICA')          or
     (upper(er.nombre) = 'RESPONSABLE MARKETING'  and upper(d.nombre) = 'MARKETING')          or
     (upper(er.nombre) = 'JEFE DE COCINA'         and upper(d.nombre) = 'COCINA')             or
     (upper(er.nombre) = 'JEFE DE SALA'           and upper(d.nombre) = 'SALA')               or
     (upper(er.nombre) = 'RESPONSABLE CALIDAD'    and upper(d.nombre) = 'CALIDAD')
   );
