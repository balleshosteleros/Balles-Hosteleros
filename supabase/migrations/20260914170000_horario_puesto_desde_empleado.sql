-- El horario del puesto, copiado del que YA tiene su gente (al revés de siempre).
--
-- Lo normal es que mande el puesto: se contrata a alguien y hereda el horario de
-- su puesto. Pero la plantilla actual entró por migración con el horario puesto
-- persona a persona, así que aquí se hace el camino inverso UNA VEZ: mirar quién
-- ocupa cada puesto, ver qué patrón tiene y guardarlo como horario del puesto.
--
-- Solo se copia cuando el dato es limpio: el empleado tiene ese puesto como
-- PRINCIPAL y un patrón vigente. Un puesto secundario de alguien no sirve — el
-- patrón que tendría sería el de su puesto de verdad, y cualquiera contratado
-- después heredaría el horario personal de otro.
--
-- HABANA + BACANAL, que son las que tienen gente con horario migrado.
--
-- Único caso limpio a día de hoy: BACANAL · COCINERO ← Eduardo Charro, patrón
-- «COCINERO 1» (viernes 6,5 h + sábado 11 h + domingo 4,5 h = 22 h, 4 libres).
-- Como la jornada del puesto SALE del horario, se recalculan con él las horas,
-- los días libres, la jornada y el coste/hora; el salario no se toca.
--
-- Idempotente: solo rellena lo que está vacío.

with candidato as (
  select p.id                                   as puesto_id,
         pa.familia_id                          as familia_id,
         -- Horas de la semana del patrón: suma de los tramos de cada turno,
         -- con la medianoche sin cortar el turno (18:00→00:30 son 6,5 h).
         round(sum(coalesce(h.horas, 0))::numeric, 2)              as horas_semanales,
         count(*) filter (where d.turno_id is null)                as dias_libres
    from puestos p
    join puesto_salarios s      on s.puesto_id = p.id and s.patron_familia_id is null
    join empleado_puestos ep    on ep.puesto_id = p.id and ep.es_principal
    join empleados e            on e.id = ep.empleado_id
                               and e.empresa_id = p.empresa_id
                               and e.estado = 'Activo'
    join rrhh_patron_empleados pe on pe.empleado_id = e.id and pe.vigente_hasta is null
    join rrhh_patrones pa       on pa.id = pe.patron_id and pa.activo and pa.es_oficial
                               and pa.empresa_id = p.empresa_id
                               and pa.puesto_id is null   -- no plantillas legacy
    join rrhh_patron_semanas ps on ps.patron_id = pa.id and ps.orden = 0
    cross join lateral (
      select i as dia, ps.dias->>i as turno_id from generate_series(0, 6) i
    ) d
    left join lateral (
      select sum(
               case when (tr->>'fin')::time <= (tr->>'inicio')::time
                    then extract(epoch from ((tr->>'fin')::time - (tr->>'inicio')::time)) / 3600 + 24
                    else extract(epoch from ((tr->>'fin')::time - (tr->>'inicio')::time)) / 3600
               end
             ) as horas
        from rrhh_turnos t, jsonb_array_elements(t.tramos) tr
       where t.id = d.turno_id and t.tipo_jornada = 'fijo'
    ) h on true
   where p.empresa_id in ('00000000-0000-0000-0000-000000000001',
                          'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47')
   group by p.id, pa.familia_id
  having count(distinct pa.familia_id) = 1   -- un solo horario entre su gente
)
update puesto_salarios s
   set patron_familia_id = c.familia_id,
       horas_semanales   = c.horas_semanales,
       dias_libres       = c.dias_libres,
       -- ≥ 40 h = Completa (convenio de Hostelería de Madrid); por debajo, Parcial.
       jornada_contrato  = case when c.horas_semanales >= 40 then 'Completa' else 'Parcial' end,
       coste_hora        = case
                             when c.horas_semanales > 0
                             then round(s.salario_bruto / (c.horas_semanales * 52 / 12.0), 4)
                             else s.coste_hora
                           end,
       updated_at        = now()
  from candidato c
 where s.puesto_id = c.puesto_id
   and s.patron_familia_id is null;
