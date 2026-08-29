-- Importaciones de Drive que siguen solas, sin pestaña abierta.
--
-- Hasta ahora la copia solo avanzaba mientras el navegador pedía la siguiente
-- tanda: cerrar la pestaña la paraba. Con 124 GB eso obliga a tener el
-- ordenador encendido un día entero.
--
-- Para que un cron la continúe hace falta saber CON QUÉ CUENTA de Google
-- seguir: el permiso vive en `google_cuentas_usuario`, pero sin esta columna
-- no hay forma de saber cuál de las cuentas conectadas usó la importación.

alter table public.archivos_importaciones
  add column if not exists google_email text;

comment on column public.archivos_importaciones.google_email is
  'Cuenta de Google con la que se lanzó. La usa el cron para recuperar el permiso y continuar sin nadie delante.';

-- Solo interesan las que están a medias; el índice se queda pequeño.
create index if not exists archivos_importaciones_pendientes_idx
  on public.archivos_importaciones (updated_at)
  where estado in ('en_curso', 'parada');
