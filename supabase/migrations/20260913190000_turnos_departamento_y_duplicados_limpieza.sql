-- El color de un turno en el cuadrante sale de su departamento. Un turno sin
-- departamento se pinta con el gris neutro de reserva, y eso confundia:
-- salian de otro color turnos que si tienen equipo. Ademas, la limpieza de
-- BACANAL arrastraba dos turnos clonados (mismo horario, distinto codigo).
-- Idempotente: se puede reaplicar sin efecto.

-- 1) Turnos de gerencia que se quedaron sin departamento (salian en gris).
UPDATE rrhh_turnos
   SET departamento = 'GERENCIA'
 WHERE id IN ('bt-ger-mie-0900', 'ht-ger-mar-1200')
   AND COALESCE(BTRIM(departamento), '') = '';

-- 2) El turno de limpieza entre semana sigue al departamento de su puesto
--    (LIMPIEZA pertenece a SALA), para que la semana entera sea de un color.
UPDATE rrhh_turnos
   SET departamento = 'SALA'
 WHERE id = 'bt-lim-diario'
   AND departamento IS DISTINCT FROM 'SALA';

-- 3) Clones de limpieza: el patron apunta al turno que se queda y el clon se
--    borra, siempre que no lo use nadie.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM rrhh_turnos WHERE id = 'bt-lim-diario') THEN
    UPDATE rrhh_patron_semanas
       SET dias = REPLACE(dias::text, '"bt-lim-lun"', '"bt-lim-diario"')::jsonb
     WHERE dias::text LIKE '%"bt-lim-lun"%';

    DELETE FROM rrhh_turnos t
     WHERE t.id = 'bt-lim-lun'
       AND NOT EXISTS (SELECT 1 FROM rrhh_planificacion p WHERE p.turno_id = t.id)
       AND NOT EXISTS (SELECT 1 FROM rrhh_turno_empleados te WHERE te.turno_id = t.id);
  END IF;

  IF EXISTS (SELECT 1 FROM rrhh_turnos WHERE id = 'bt-lpo-dom-1130') THEN
    UPDATE rrhh_patron_semanas
       SET dias = REPLACE(dias::text, '"bt-lpo-dom"', '"bt-lpo-dom-1130"')::jsonb
     WHERE dias::text LIKE '%"bt-lpo-dom"%';

    DELETE FROM rrhh_turnos t
     WHERE t.id = 'bt-lpo-dom'
       AND NOT EXISTS (SELECT 1 FROM rrhh_planificacion p WHERE p.turno_id = t.id)
       AND NOT EXISTS (SELECT 1 FROM rrhh_turno_empleados te WHERE te.turno_id = t.id);
  END IF;
END $$;
