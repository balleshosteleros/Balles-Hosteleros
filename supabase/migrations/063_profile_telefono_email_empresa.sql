-- Añade contacto de empresa al perfil personal del empleado.
-- `telefono` y `email_personal` siguen siendo del trabajador a título privado;
-- estos dos nuevos campos son los corporativos (extensión interna, email asignado
-- por la empresa). Alineado con `empleados.email_empresa` ya existente.
alter table public.profiles
  add column if not exists telefono_empresa text,
  add column if not exists email_empresa text;

comment on column public.profiles.telefono_empresa is
  'Teléfono corporativo del empleado (extensión, móvil de empresa).';
comment on column public.profiles.email_empresa is
  'Email corporativo del empleado, distinto del email de login y del email_personal.';
