-- Documentos personales del empleado (nóminas, contratos, justificantes,
-- registros de jornada). Archivos en el bucket privado `empleados-docs`.
create table if not exists public.documentos_empleado (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  categoria text not null check (categoria in ('nominas','contratos','justificantes','registros-jornada')),
  nombre text not null,
  storage_path text not null,
  tipo_mime text,
  tamano_bytes bigint,
  created_at timestamptz not null default now(),
  created_by uuid
);

create index if not exists idx_documentos_empleado_emp on public.documentos_empleado (empleado_id, categoria);

alter table public.documentos_empleado enable row level security;

-- El empleado solo ve SUS documentos (incluye sus fichas espejo multi-empresa).
-- Las altas/bajas las hace RRHH por server action con cliente admin (service role),
-- que ignora RLS; por eso aquí basta una política de lectura del propio empleado.
drop policy if exists doc_emp_read on public.documentos_empleado;
create policy doc_emp_read on public.documentos_empleado
  for select using (
    empleado_id in (select id from public.empleados where user_id = auth.uid())
  );
