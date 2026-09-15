-- HABANA · LOGISTICA y RECURSOS HUMANOS toman el horario del gerente.
--
-- Los dos puestos los ocupa Alejandro Mojica como puesto SECUNDARIO (su puesto
-- principal es GERENTE), así que el horario que llevan es el suyo personal:
-- «GERENTE - ALEJANDRO». Se copia por decisión expresa del dueño (15-09-2026),
-- sabiendo que quien se contrate mañana para Logística o para RRHH heredará ese
-- horario mientras no se le ponga uno propio.
--
-- Se guarda la FAMILIA del patrón, no una versión: así sigue siempre la vigente
-- (ayer se creó la versión 2 y es la que rige). Las horas, los días libres y la
-- jornada salen de esa versión vigente, no se teclean.
--
-- Idempotente: solo rellena lo que está vacío.

with vigente as (
  select distinct on (familia_id) familia_id, id
    from rrhh_patrones
   where familia_id = 'a1000000-0000-0000-0000-000000000002'
     and activo and es_oficial
     and vigente_desde <= current_date
     and (vigente_hasta is null or vigente_hasta >= current_date)
   order by familia_id, vigente_desde desc, version desc
), jornada as (
  select v.familia_id,
         round(sum(h.horas) / count(distinct ps.orden), 2)                     as horas_semanales,
         round(count(*) filter (where t.id is null)::numeric
               / count(distinct ps.orden))                                     as dias_libres
    from vigente v
    join rrhh_patron_semanas ps on ps.patron_id = v.id
    cross join lateral (select i as dia, ps.dias->>i as turno_id from generate_series(0,6) i) d
    left join rrhh_turnos t on t.id = d.turno_id
    cross join lateral (
      select case
               when t.id is null then 0
               when t.tipo_jornada = 'flexible' then coalesce(t.flex_horas_dia, 0)
               else coalesce((
                 select sum(case when (tr->>'fin')::time <= (tr->>'inicio')::time
                            then extract(epoch from ((tr->>'fin')::time - (tr->>'inicio')::time))/3600 + 24
                            else extract(epoch from ((tr->>'fin')::time - (tr->>'inicio')::time))/3600 end)
                   from jsonb_array_elements(t.tramos) tr), 0)
             end as horas
    ) h
   group by v.familia_id
)
update puesto_salarios s
   set patron_familia_id = j.familia_id,
       horas_semanales   = j.horas_semanales,
       dias_libres       = j.dias_libres,
       jornada_contrato  = case when j.horas_semanales >= 40 then 'Completa' else 'Parcial' end,
       coste_hora        = case when j.horas_semanales > 0
                                then round(s.salario_bruto / (j.horas_semanales * 52 / 12.0), 4)
                                else s.coste_hora end,
       updated_at        = now()
  from jornada j, puestos p
 where p.id = s.puesto_id
   and p.empresa_id = '00000000-0000-0000-0000-000000000001'
   and p.nombre in ('LOGISTICA', 'RECURSOS HUMANOS')
   and s.patron_familia_id is null;
