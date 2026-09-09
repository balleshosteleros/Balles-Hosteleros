-- Precio al que se paga una HORA EXTRA en este puesto.
--
-- Las horas extras que se hacen cada mes NO son un dato del puesto (eso pasa o
-- no pasa, y va en la nómina). Lo que sí es del puesto, y además es exacto, es
-- a cuánto se paga cada una.
--
-- Idempotente.

alter table public.puesto_salarios
  add column if not exists precio_hora_extra numeric(10,4);

alter table public.empleado_condiciones
  add column if not exists precio_hora_extra numeric(10,4);

comment on column public.puesto_salarios.precio_hora_extra is
  'A cuánto se paga una hora extra en este puesto. Quien cobra POR HORA la tiene al mismo precio que su hora normal.';
comment on column public.empleado_condiciones.precio_hora_extra is
  'Copiado del puesto al contratar. A cuánto se le paga una hora extra a este trabajador.';

alter table public.puesto_salarios drop constraint if exists puesto_salarios_precio_hora_extra_no_negativo;
alter table public.puesto_salarios add constraint puesto_salarios_precio_hora_extra_no_negativo
  check (precio_hora_extra is null or precio_hora_extra >= 0);

alter table public.empleado_condiciones drop constraint if exists empleado_condiciones_precio_hora_extra_no_negativo;
alter table public.empleado_condiciones add constraint empleado_condiciones_precio_hora_extra_no_negativo
  check (precio_hora_extra is null or precio_hora_extra >= 0);

-- Punto de partida: 10 € la hora extra en todo puesto que no lo tenga puesto.
update public.puesto_salarios
   set precio_hora_extra = 10, updated_at = now()
 where precio_hora_extra is null;

-- Quien cobra POR HORA cobra la extra al mismo precio que la normal.
update public.puesto_salarios
   set precio_hora_extra = coste_hora, updated_at = now()
 where modo_pago = 'HORAS' and coste_hora is not null and coste_hora > 0
   and (precio_hora_extra is null or precio_hora_extra <> coste_hora);
