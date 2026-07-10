-- El envío del correo a la gestoría pidiendo las nóminas pasa a hacerse, por
-- defecto, el DÍA 1 de cada mes (antes era el 25). Sigue siendo editable por
-- empresa en Ajustes → Pagos → «Envío de nóminas a la gestoría».
--
-- Solo cambia el DEFAULT de la columna (las empresas ya existentes conservan su
-- valor). Idempotente.

alter table public.empresas
  alter column nominas_gestoria_dia_envio set default 1;

comment on column public.empresas.nominas_gestoria_dia_envio is
  'Día del mes (1-28) en el que el cron envía a la gestoría el enlace para subir las nóminas. Por defecto el día 1, a las 00:00 de la zona horaria de la empresa. Editable en Ajustes → Pagos.';
