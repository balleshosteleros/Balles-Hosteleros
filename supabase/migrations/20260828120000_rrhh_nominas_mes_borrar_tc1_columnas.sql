-- Borrado de las columnas `tc1_*` de `rrhh_nominas_mes`.
--
-- El TC1 dejó de ser un campo del mes en 20260828110000: ahora vive en
-- `rrhh_nominas_tc1`, que admite VARIOS recibos por mes (la liquidación
-- ordinaria y las complementarias de vacaciones). Aquellas columnas quedaron
-- como respaldo del histórico; comprobado que ya no las lee nadie y que no
-- quedaba ninguna fila con datos, se eliminan.
--
-- Idempotente: re-ejecutable sin error.

alter table public.rrhh_nominas_mes
  drop column if exists tc1_path,
  drop column if exists tc1_nombre,
  drop column if exists tc1_importe,
  drop column if exists tc1_trabajadores,
  drop column if exists tc1_subido_en,
  drop column if exists tc1_subido_por;
