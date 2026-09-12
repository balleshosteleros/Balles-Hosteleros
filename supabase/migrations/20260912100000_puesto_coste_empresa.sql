-- Lo que cuesta el puesto A LA EMPRESA, no solo lo que cobra el trabajador.
--
-- El bruto es lo que se pacta; encima va la cotizacion patronal, que en las
-- nominas de las tres sociedades es del 32,15% (23,60 contingencias comunes +
-- 5,50 desempleo + 0,75 MEI + 0,80 IT + 0,70 IMS + 0,60 FP + 0,20 FOGASA).
-- Verificado contra las 17 nominas de 08/2026: sale 32,15% en todas.
--
-- Se guardan calculados (no al vuelo) porque el tipo puede cambiar: el
-- desempleo es 6,70% en temporales y los tipos de IT/IMS dependen de la
-- actividad, asi que el dia que un puesto cotice distinto basta con escribir su
-- cifra sin tocar formulas repartidas por el codigo.
--
-- Idempotente: `if not exists` y relleno solo donde falta.

alter table puesto_salarios add column if not exists ss_empresa numeric;
alter table puesto_salarios add column if not exists coste_empresa numeric;

comment on column puesto_salarios.ss_empresa is
  'Cotizacion a cargo de la EMPRESA por este puesto (32,15% del bruto en hosteleria, contrato indefinido).';
comment on column puesto_salarios.coste_empresa is
  'Lo que cuesta el puesto en total: bruto + cotizacion patronal.';

update puesto_salarios
set ss_empresa = round((salario_bruto * 0.3215)::numeric, 2),
    coste_empresa = round((salario_bruto * 1.3215)::numeric, 2),
    updated_at = now()
where coalesce(salario_bruto, 0) > 0
  and (ss_empresa is null or coste_empresa is null
       or ss_empresa <> round((salario_bruto * 0.3215)::numeric, 2));
