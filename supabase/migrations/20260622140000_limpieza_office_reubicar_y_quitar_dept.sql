-- Modelo correcto: "limpieza/office" no es un departamento.
--   · Puesto LIMPIEZA (limpiadora) → departamento SALA
--   · Puesto OFFICE               → departamento COCINA
--   · Se elimina el departamento LIMPIEZA (0 empleados).
--   · El turno "OFFICE DIARIO" estaba mal etiquetado en SALA → COCINA.
-- Idempotente. Aplica a todas las empresas que tengan el dept LIMPIEZA.

-- 1) Puestos al departamento correcto de su empresa
UPDATE puestos p SET departamento_id = s.id
FROM departamentos lim, departamentos s
WHERE p.departamento_id = lim.id AND lim.nombre = 'LIMPIEZA'
  AND upper(trim(p.nombre)) = 'LIMPIEZA'
  AND s.empresa_id = p.empresa_id AND s.nombre = 'SALA';

UPDATE puestos p SET departamento_id = c.id
FROM departamentos lim, departamentos c
WHERE p.departamento_id = lim.id AND lim.nombre = 'LIMPIEZA'
  AND upper(trim(p.nombre)) = 'OFFICE'
  AND c.empresa_id = p.empresa_id AND c.nombre = 'COCINA';

-- 2) Vacantes que colgaban del dept LIMPIEZA → al nuevo dept de su puesto
UPDATE vacantes v SET departamento_id = p.departamento_id
FROM puestos p, departamentos lim
WHERE v.puesto_id = p.id
  AND v.departamento_id = lim.id AND lim.nombre = 'LIMPIEZA';

-- 3) Quitar el nodo LIMPIEZA del organigrama vivo (node id = uuid del depto) y edges
WITH limp AS (
  SELECT empresa_slug, array_agg(n->>'id') AS ids
  FROM organigramas, jsonb_array_elements(nodes) n
  WHERE n->>'label' = 'LIMPIEZA' GROUP BY empresa_slug
)
UPDATE organigramas o SET
  nodes = COALESCE((SELECT jsonb_agg(n) FROM jsonb_array_elements(o.nodes) n
                    WHERE n->>'label' <> 'LIMPIEZA'), '[]'::jsonb),
  edges = COALESCE((SELECT jsonb_agg(e) FROM jsonb_array_elements(o.edges) e
                    WHERE NOT (e->>'source' = ANY(limp.ids) OR e->>'target' = ANY(limp.ids))), '[]'::jsonb)
FROM limp WHERE o.empresa_slug = limp.empresa_slug;

-- 4) Eliminar el departamento LIMPIEZA (ya sin puestos/vacantes/empleados)
DELETE FROM departamentos WHERE nombre = 'LIMPIEZA';

-- 5) Office pertenece a COCINA: corrige el etiquetado del turno
UPDATE rrhh_turnos SET departamento = 'COCINA'
WHERE upper(trim(nombre)) = 'OFFICE DIARIO' AND upper(trim(departamento)) = 'SALA';
