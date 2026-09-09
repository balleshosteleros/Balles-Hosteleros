-- Cómo se le paga a un puesto: sueldo fijo al mes, o por hora trabajada.
--
-- Hasta ahora todo puesto se trataba como sueldo mensual, y para quien cobra por
-- hora (músicos, cantantes, extras) eso no vale: no tienen sueldo mensual ni
-- horas semanales, tienen un precio por hora. Meterlos como mensuales inflaba su
-- coste y además les imputaba vacaciones que no cobran.
--
-- MENSUAL: `salario_bruto` es el sueldo del mes. El coste de la hora se deduce.
-- HORAS:   `salario_bruto` es el precio BRUTO de una hora. No hay sueldo mensual.
--
-- Idempotente.

alter table public.puesto_salarios
  add column if not exists modo_pago text not null default 'MENSUAL';

alter table public.empleado_condiciones
  add column if not exists modo_pago text not null default 'MENSUAL';

comment on column public.puesto_salarios.modo_pago is
  'MENSUAL: salario_bruto es el sueldo del mes. HORAS: salario_bruto es el precio bruto de una hora trabajada.';
comment on column public.empleado_condiciones.modo_pago is
  'Copiado del puesto al contratar. MENSUAL: salario_bruto es sueldo del mes. HORAS: precio bruto por hora.';

alter table public.puesto_salarios drop constraint if exists puesto_salarios_modo_pago_valido;
alter table public.puesto_salarios add constraint puesto_salarios_modo_pago_valido
  check (modo_pago in ('MENSUAL', 'HORAS'));

alter table public.empleado_condiciones drop constraint if exists empleado_condiciones_modo_pago_valido;
alter table public.empleado_condiciones add constraint empleado_condiciones_modo_pago_valido
  check (modo_pago in ('MENSUAL', 'HORAS'));

-- En modo HORAS el precio de la hora ES el salario bruto: se mantienen alineados
-- para que nadie tenga que escribir el mismo número dos veces.
update public.puesto_salarios
   set coste_hora = salario_bruto
 where modo_pago = 'HORAS' and salario_bruto > 0
   and (coste_hora is null or coste_hora <> salario_bruto);

update public.empleado_condiciones
   set coste_hora = salario_bruto
 where modo_pago = 'HORAS' and salario_bruto > 0
   and (coste_hora is null or coste_hora <> salario_bruto);
