-- Historial de altas y bajas del empleado en el sistema.
--
-- Hasta ahora el cambio de estado desde la ficha (tarjeta "Estado y acceso al
-- sistema") era un UPDATE ciego sobre `empleados.estado`: no quedaba constancia
-- de quién dio de alta o de baja a nadie, ni cuándo, ni por qué. Esta tabla lo
-- registra, y es solo-append: nunca se edita ni se borra una línea.
--
-- Importa porque ese cambio manual se salta el flujo de contratación de
-- reclutamiento (alta a gestoría, contrato a firmar, condiciones, email de
-- acceso). Al reactivar guardamos en `avisos_omitidos` la lista de pasos que NO
-- se ejecutaron, para que la ficha pueda enseñarlos y RRHH los complete a mano.
--
-- Arranca vacío: no se reconstruye el pasado (no hay dato fiable de autoría).
--
-- Idempotente.

create table if not exists public.empleado_estado_historial (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  -- 'Alta' (pasa a Activo) | 'Baja' (pasa a Inactivo)
  accion text not null check (accion in ('Alta', 'Baja')),
  estado_anterior text,
  estado_nuevo text not null,
  -- Fecha efectiva del movimiento (la que teclea el usuario, no el timestamp).
  -- En un Alta es la fecha de alta; en una Baja, la fecha de baja. Obligatoria.
  fecha_efectiva date not null,
  motivo text,
  -- Pasos del flujo de contratación que este cambio manual NO ejecutó.
  -- ["gestoria", "contrato", "acceso", ...]
  avisos_omitidos jsonb not null default '[]'::jsonb,
  -- Origen del cambio: 'ficha' (manual) | 'contratacion' | 'promocion' | 'sistema'
  origen text not null default 'ficha',
  usuario_id uuid,
  usuario_nombre text,
  created_at timestamptz not null default now()
);

create index if not exists idx_empleado_estado_historial_empleado
  on public.empleado_estado_historial (empleado_id, created_at desc);

-- ── RLS multi-tenant ────────────────────────────────────────────────────────
alter table public.empleado_estado_historial enable row level security;

drop policy if exists "empleado_estado_historial_select" on public.empleado_estado_historial;
drop policy if exists "empleado_estado_historial_insert" on public.empleado_estado_historial;

create policy "empleado_estado_historial_select"
  on public.empleado_estado_historial for select
  using (empresa_id in (select empresas_del_usuario()));

create policy "empleado_estado_historial_insert"
  on public.empleado_estado_historial for insert
  with check (empresa_id in (select empresas_del_usuario()));

-- Sin policy de UPDATE ni DELETE a propósito: el historial es inmutable.
