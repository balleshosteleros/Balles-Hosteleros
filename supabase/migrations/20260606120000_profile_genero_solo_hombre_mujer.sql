-- Género del empleado: dejar únicamente 'hombre' y 'mujer' para todas las empresas.
-- Se retiran 'otro' y 'prefiero_no_decirlo'. Valores actuales fuera del nuevo set se ponen a NULL.
update public.profiles
  set genero = null
  where genero is not null and genero not in ('mujer','hombre');

alter table public.profiles
  drop constraint if exists profiles_genero_check;

alter table public.profiles
  add constraint profiles_genero_check
  check (genero in ('mujer','hombre'));
