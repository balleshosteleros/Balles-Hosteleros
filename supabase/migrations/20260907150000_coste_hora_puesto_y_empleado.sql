-- Coste de la hora: dato propio del puesto que viaja al empleado al contratarlo.
-- Antes se deducía al vuelo, así que no se podía corregir a mano y el histórico
-- cambiaba solo si alguien editaba el sueldo del puesto.
-- Idempotente.

alter table public.puesto_salarios
  add column if not exists coste_hora numeric(10,4);
comment on column public.puesto_salarios.coste_hora is
  'Lo que cuesta una hora de este puesto (bruto, sin Seguridad Social de empresa). Si se deja vacío se calcula del salario bruto y las horas semanales.';

alter table public.empleado_condiciones
  add column if not exists coste_hora numeric(10,4);
comment on column public.empleado_condiciones.coste_hora is
  'Coste de la hora de este trabajador, copiado del puesto al contratar o promocionar. Es una foto del momento.';

-- Rellenar lo existente con el cálculo que se venía usando, para que nadie vea
-- cifras distintas tras la migración. Nunca se pisa un valor puesto a mano.
update public.puesto_salarios
   set coste_hora = round((salario_bruto * 12.0) / (52.0 * horas_semanales), 4)
 where coste_hora is null
   and salario_bruto is not null and salario_bruto > 0
   and horas_semanales is not null and horas_semanales > 0;

update public.empleado_condiciones
   set coste_hora = round((salario_bruto * 12.0) / (52.0 * horas_semanales), 4)
 where coste_hora is null
   and salario_bruto is not null and salario_bruto > 0
   and horas_semanales is not null and horas_semanales > 0;

alter table public.puesto_salarios drop constraint if exists puesto_salarios_coste_hora_no_negativo;
alter table public.puesto_salarios add constraint puesto_salarios_coste_hora_no_negativo
  check (coste_hora is null or coste_hora >= 0);

alter table public.empleado_condiciones drop constraint if exists empleado_condiciones_coste_hora_no_negativo;
alter table public.empleado_condiciones add constraint empleado_condiciones_coste_hora_no_negativo
  check (coste_hora is null or coste_hora >= 0);
