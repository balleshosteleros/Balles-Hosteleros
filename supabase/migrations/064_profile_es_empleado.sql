-- Marca si el perfil corresponde a un empleado de plantilla o a un usuario
-- externo (asesor, inversor, gestor, abogado, etc.). Permite filtrar el
-- listado de "Usuarios" en Ajustes y separarlos del resto del personal.
--
-- Por defecto = true para no invalidar perfiles previos (la plantilla
-- existente ya está cargada como empleados).
alter table public.profiles
  add column if not exists es_empleado boolean not null default true;

comment on column public.profiles.es_empleado is
  'true = empleado de la plantilla; false = usuario externo (asesor, inversor, gestor, etc.).';

create index if not exists idx_profiles_es_empleado
  on public.profiles (es_empleado);
