-- SALARIO BRUTO ≠ NETO: se deja de copiar el bruto en el campo del neto.
--
-- Problema: `upsertPuestoSalario` guardaba el mismo importe en `salario_bruto`,
-- `nomina_neta` y `salario_neto`. Como el alta a la gestoría lee `salario_neto` y
-- lo etiqueta "Salario neto", un puesto de 1.800 € BRUTOS generaba un contrato
-- declarando 1.800 € NETOS — un dato falso enviado a un tercero.
--
-- Además `nomina_neta`/`salario_neto` eran `not null default 0`, de modo que "no
-- calculado" y "0 €" eran indistinguibles (contra la regla 0 € ≠ sin dato).
--
-- Ahora:
--   • El BRUTO es el dato pactado y el que viaja a la gestoría (ya con su
--     etiqueta correcta, "Salario bruto").
--   • El NETO queda NULL mientras no exista un cálculo real: no se puede deducir
--     del bruto sin conocer IRPF, cotización y jornada del trabajador.
--   • `empleado_condiciones` gana su propia columna `salario_bruto`.
--
-- Idempotente: re-ejecutable sin error.

-- 1) Condiciones del empleado: columna propia para el bruto.
alter table public.empleado_condiciones
  add column if not exists salario_bruto numeric(12,2);

comment on column public.empleado_condiciones.salario_bruto is
  'Salario BRUTO pactado (fuente: puesto_salarios.salario_bruto). Es la cifra que se declara a la gestoría.';

update public.empleado_condiciones
set salario_bruto = salario_neto
where salario_bruto is null and salario_neto is not null;

update public.empleado_condiciones
set salario_neto = null, nomina_neta = null
where salario_bruto is not null
  and salario_neto is not null
  and salario_bruto = salario_neto;

-- 2) Puesto: el neto pasa a opcional (null = no calculado).
alter table public.puesto_salarios
  alter column nomina_neta  drop not null,
  alter column nomina_neta  drop default,
  alter column salario_neto drop not null,
  alter column salario_neto drop default;

comment on column public.puesto_salarios.salario_bruto is
  'Salario BRUTO del nivel: la cifra pactada y la que se declara a la gestoría.';
comment on column public.puesto_salarios.salario_neto is
  'Líquido a percibir. NULL = no calculado (nunca una copia del bruto).';

update public.puesto_salarios
set salario_neto = null, nomina_neta = null
where salario_bruto is not null and salario_neto = salario_bruto;
