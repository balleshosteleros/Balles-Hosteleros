-- Múltiples nóminas por empleado/mes (rrhh_pagos_nominas).
-- Un empleado puede tener 2+ nóminas en un mismo mes (p.ej. finiquito + normal).
-- Cada nómina individual se guarda aquí con sus importes y su documento; la fila
-- de rrhh_pagos mantiene la SUMA (ss_empleado, ss_empresa, irpf, nomina) para no
-- romper el resto del módulo. El nº de nóminas se cuenta desde esta tabla.
--
-- Idempotente: re-ejecutable sin error.

create table if not exists public.rrhh_pagos_nominas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  periodo text not null,                       -- 'AAAA-MM'
  ss_empleado numeric(12,2) not null default 0,
  ss_empresa  numeric(12,2) not null default 0,
  irpf        numeric(12,2) not null default 0,
  neto        numeric(12,2) not null default 0,
  nomina_path text,                            -- documento de ESTA nómina (bucket rrhh-nominas)
  orden int not null default 0,                -- para mostrarlas en orden estable
  created_at timestamptz not null default now()
);

comment on table public.rrhh_pagos_nominas is
  'Nóminas individuales de un empleado en un mes (puede haber varias). rrhh_pagos guarda la suma.';

create index if not exists idx_rrhh_pagos_nominas_emp
  on public.rrhh_pagos_nominas (empresa_id, empleado_id, periodo);

-- RLS: misma política que rrhh_pagos (empresa del usuario).
alter table public.rrhh_pagos_nominas enable row level security;

drop policy if exists "rrhh_pagos_nominas_rw" on public.rrhh_pagos_nominas;
create policy "rrhh_pagos_nominas_rw" on public.rrhh_pagos_nominas
  for all to authenticated
  using (public.user_has_empresa_access(empresa_id))
  with check (public.user_has_empresa_access(empresa_id));
