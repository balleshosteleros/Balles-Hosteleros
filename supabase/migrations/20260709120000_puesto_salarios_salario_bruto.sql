-- Puesto trabaja con SALARIO BRUTO (mensual) como cifra principal.
-- Se añade `salario_bruto` a puesto_salarios. Las columnas neto (nomina_neta,
-- efectivo_extra, salario_neto) se conservan por compatibilidad con la
-- contratación y el envío a gestoría, que leen `salario_neto`; el código las
-- rellena en espejo del bruto mientras no exista un cálculo bruto→neto real.
-- Idempotente.

alter table public.puesto_salarios
  add column if not exists salario_bruto numeric(10,2) not null default 0;

comment on column public.puesto_salarios.salario_bruto is
  'Salario BRUTO mensual del puesto (cifra principal en la ficha). El neto se conserva por compatibilidad con contratación/gestoría.';
