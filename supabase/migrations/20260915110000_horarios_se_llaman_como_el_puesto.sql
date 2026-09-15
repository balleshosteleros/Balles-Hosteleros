-- El horario se llama igual que el puesto al que sirve.
--
-- Los patrones venían con nombres de dos épocas: unos numerados del seed
-- («COCINERO 1», «LIMPIEZA 1») y otros con el nombre de la persona que los
-- estrenó («GERENTE - ALEJANDRO», «JEFE DE SALA - KAREN»). Ninguno de los dos
-- sirve: el horario es del PUESTO, no de quien lo ocupa hoy — el día que
-- Alejandro cambie de sitio, «GERENTE - ALEJANDRO» pasa a ser una etiqueta que
-- engaña a quien la lee.
--
-- Se renombran TODAS las versiones de cada familia (el histórico incluido), para
-- que un patrón no se llame de dos maneras según la versión que se mire.
--
-- Solo se tocan los que están vinculados a un puesto (`puesto_salarios.
-- patron_familia_id`): los sueltos no tienen puesto del que tomar el nombre.
--
-- Si una familia sirve a VARIOS puestos, manda aquel del que es principal el
-- empleado que la lleva; a igualdad, el primero por orden alfabético. Hoy pasa
-- con el horario del gerente, que usan también Logística y RRHH de HABANA: se
-- queda en «GERENTE».
--
-- Idempotente: reaplicarlo no cambia nada una vez hechos los nombres.

with vinculo as (
  select distinct on (s.patron_familia_id)
         s.patron_familia_id as familia_id,
         p.nombre            as nombre_puesto
    from puesto_salarios s
    join puestos p on p.id = s.puesto_id
   where s.patron_familia_id is not null
   order by s.patron_familia_id,
            -- Primero el puesto que es el principal de quien lleva ese horario.
            (exists (
              select 1
                from empleado_puestos ep
                join rrhh_patron_empleados pe on pe.empleado_id = ep.empleado_id
                join rrhh_patrones pa on pa.id = pe.patron_id
               where ep.puesto_id = p.id
                 and ep.es_principal
                 and pa.familia_id = s.patron_familia_id
            )) desc,
            p.nombre
)
update rrhh_patrones pa
   set nombre     = v.nombre_puesto,
       updated_at = now()
  from vinculo v
 where pa.familia_id = v.familia_id
   and pa.nombre is distinct from v.nombre_puesto;
