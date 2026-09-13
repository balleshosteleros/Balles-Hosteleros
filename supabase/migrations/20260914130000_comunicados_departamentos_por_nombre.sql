-- Un comunicado guardaba en `departamentos_destinatarios` los IDs de los
-- departamentos en vez de sus nombres. La audiencia se resuelve comparando ese
-- array con `usuarios.departamento`, que es el NOMBRE: ningún ID casaba, así
-- que el comunicado se publicó y no avisó a nadie —cero notificaciones, cero
-- correos, alcance 0 %—, y en la lista el globo de "3 dptos" enseñaba UUIDs.
--
-- Traduce cualquier ID que quede guardado al nombre del departamento de SU
-- empresa. Idempotente: solo toca las filas donde todavía hay algo con pinta
-- de UUID, así que pasarla dos veces no cambia nada.

update comunicados c
set departamentos_destinatarios = sub.nombres,
    updated_at = now()
from (
  select c2.id,
         array_agg(coalesce(d.nombre, x.val) order by x.ord) as nombres
  from comunicados c2,
       lateral unnest(c2.departamentos_destinatarios) with ordinality as x(val, ord)
       left join lateral (
         select d.nombre from departamentos d
          where d.id::text = x.val and d.empresa_id = c2.empresa_id
       ) d on true
  where exists (
    select 1 from unnest(c2.departamentos_destinatarios) v where v ~ '^[0-9a-f]{8}-'
  )
  group by c2.id
) sub
where c.id = sub.id;

-- No puede quedar ni un ID suelto.
do $$
declare n int;
begin
  select count(*) into n
    from comunicados c, unnest(c.departamentos_destinatarios) v
   where v ~ '^[0-9a-f]{8}-';
  if n > 0 then
    raise exception 'Quedan % departamentos guardados como ID', n;
  end if;
end $$;
