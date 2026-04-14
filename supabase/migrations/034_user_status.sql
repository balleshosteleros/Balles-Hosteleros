-- Migration 034: Add estado_acceso to profiles
-- Allowed values: Activo, Inactivo, Pendiente (Bloqueado removed)

alter table public.profiles
  add column if not exists estado_acceso text not null default 'Activo'
    check (estado_acceso in ('Activo', 'Inactivo', 'Pendiente'));

-- Migrate any existing rows that may have 'Bloqueado' stored elsewhere (safety)
update public.profiles
set estado_acceso = 'Inactivo'
where estado_acceso = 'Bloqueado';
