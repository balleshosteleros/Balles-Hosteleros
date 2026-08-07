-- Nóminas: cierre del acceso directo al bucket `rrhh-nominas`.
--
-- La política anterior (`rrhh_nominas_read`, en 20260706120000) daba SELECT a
-- cualquier usuario autenticado con acceso a la empresa: el path solo lleva
-- `<empresa>/<periodo>/…`, así que NO distinguía de qué empleado es cada nómina.
-- Cualquier trabajador de la empresa podía leer las nóminas de todos sus
-- compañeros consultando el bucket directamente desde el navegador.
--
-- No hace falta para nada: TODO el acceso legítimo (Pagos, diálogo de revisión y
-- el portal del empleado) se sirve desde el servidor con service-role, que genera
-- URLs firmadas temporales y no pasa por RLS. Verificado: ningún componente de
-- cliente accede al bucket.
--
-- Al retirarla, el bucket queda accesible SOLO por servidor. Requisito previo para
-- abrir la carpeta de nóminas al empleado en su portal.
--
-- Idempotente: re-ejecutable sin error.

drop policy if exists "rrhh_nominas_read" on storage.objects;
