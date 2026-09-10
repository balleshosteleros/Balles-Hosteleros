-- COMUNICADOS: la «prioridad» pasa a ser el TIPO de comunicado.
--
-- Iván, 10-09-2026: un comunicado no tiene prioridad alta o baja; es de un tipo
-- —urgente, novedades o informativo— y cada uno se reconoce por su color:
-- urgente en rojo, novedades en amarillo, informativo en verde.
--
-- Los que ya se habían mandado pasan a informativos, salvo los de hoy, que son
-- los del cambio de puesto de los jefes de sala y sí son urgentes.
--
-- Idempotente: se puede pasar dos veces sin romper nada.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'comunicados' and column_name = 'prioridad'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'comunicados' and column_name = 'tipo'
  ) then
    alter table public.comunicados rename column prioridad to tipo;
  end if;
end $$;

alter table public.comunicados alter column tipo set default 'informativo';

-- Lo viejo se reparte por lo que significaba: lo que iba en alto era urgente.
update public.comunicados set tipo = 'informativo' where tipo in ('baja', 'normal');
update public.comunicados set tipo = 'urgente' where tipo = 'alta';

comment on column public.comunicados.tipo is
  'Tipo de comunicado: urgente (rojo), novedades (amarillo) o informativo (verde).';
