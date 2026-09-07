-- Los cursos de LA ESCUELA (portal de alumnos de la empresa matriz) viven en
-- las mismas tablas que la formación de empleados, distinguidos por `ambito`.
-- Sin este valor no se pueden crear; con él, las lecturas de RRHH y Mi panel
-- los excluyen y no se mezclan con los cursos de puesto.
--
-- Idempotente: se puede aplicar tantas veces como haga falta.

alter table public.formacion_cursos
  drop constraint if exists formacion_cursos_ambito_check;

alter table public.formacion_cursos
  add constraint formacion_cursos_ambito_check
  check (ambito = any (array['general'::text, 'puesto'::text, 'escuela'::text]));

comment on column public.formacion_cursos.ambito is
  'puesto = curso 1:1 de un puesto de la plantilla; general = curso suelto de la empresa; escuela = curso del portal de alumnos de la empresa matriz (no se ve en RRHH ni en Mi panel).';
