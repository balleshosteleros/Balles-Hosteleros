-- ESCUELA — una ficha por persona, con su correo personal y el de la empresa.
--
-- En GoHighLevel la misma persona aparecía varias veces, una por cada correo
-- con el que hubiera entrado: Doro estaba tres veces y Guillem Masot dos. Son
-- una sola persona, y una persona es una ficha.
--
-- Se copia el modelo de los empleados: `email_personal` es el suyo de siempre y
-- `email_empresa` solo se rellena cuando hay un corporativo de verdad. `email`
-- sigue siendo la LLAVE de acceso y no se toca, pero al portal se entra con
-- CUALQUIERA de los correos de la ficha: si al juntar fichas solo valiera uno,
-- a quien usara el otro le habríamos cerrado la puerta sin avisar.
alter table public.escuela_alumnos
  add column if not exists email_personal text,
  add column if not exists email_empresa text;

-- Los tres correos de una ficha se buscan por igual al pedir el código.
create index if not exists idx_escuela_alumnos_email_personal
  on public.escuela_alumnos (empresa_id, lower(email_personal)) where email_personal is not null;
create index if not exists idx_escuela_alumnos_email_empresa
  on public.escuela_alumnos (empresa_id, lower(email_empresa)) where email_empresa is not null;
