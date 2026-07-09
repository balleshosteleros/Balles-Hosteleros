-- Elimina de la tabla `puestos` los campos de gestoría que NO se usan:
-- grupo/categoría profesional y epígrafe de cotización. Se retiraron del formulario
-- y del email a la gestoría (decisión de producto). Ambas columnas estaban 100%
-- vacías. Idempotente.
alter table public.puestos drop column if exists grupo_categoria_prof;
alter table public.puestos drop column if exists epigrafe_cotizacion;
