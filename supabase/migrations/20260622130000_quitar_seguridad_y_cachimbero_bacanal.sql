-- Quita el departamento/puesto SEGURIDAD de TODAS las empresas (no es canónico)
-- y el puesto CACHIMBEROS solo de BACANAL (no existe de verdad ahí).
-- Idempotente: re-ejecutar no falla.

-- ── SEGURIDAD: fuera de todos lados ───────────────────────────────────────────
-- 1) Vacantes ligadas a depto o puesto SEGURIDAD
DELETE FROM vacantes v USING departamentos d
  WHERE v.departamento_id = d.id AND d.nombre = 'SEGURIDAD';
DELETE FROM vacantes v USING puestos p
  WHERE v.puesto_id = p.id AND p.nombre = 'SEGURIDAD';

-- 2) Limpia el nodo SEGURIDAD del organigrama (node id = uuid del depto) y sus edges
WITH seg AS (
  SELECT empresa_slug, array_agg(n->>'id') AS ids
  FROM organigramas, jsonb_array_elements(nodes) n
  WHERE n->>'label' = 'SEGURIDAD'
  GROUP BY empresa_slug
)
UPDATE organigramas o SET
  nodes = COALESCE((SELECT jsonb_agg(n) FROM jsonb_array_elements(o.nodes) n
                    WHERE n->>'label' <> 'SEGURIDAD'), '[]'::jsonb),
  edges = COALESCE((SELECT jsonb_agg(e) FROM jsonb_array_elements(o.edges) e
                    WHERE NOT (e->>'source' = ANY(seg.ids) OR e->>'target' = ANY(seg.ids))), '[]'::jsonb)
FROM seg
WHERE o.empresa_slug = seg.empresa_slug;

-- 3) Puesto, departamento y etiqueta de filtro
DELETE FROM puestos       WHERE nombre = 'SEGURIDAD';
DELETE FROM departamentos WHERE nombre = 'SEGURIDAD';
DELETE FROM etiquetas     WHERE tipo = 'DEPARTAMENTO' AND nombre = 'Seguridad';

-- ── CACHIMBERO: solo BACANAL ──────────────────────────────────────────────────
DELETE FROM vacantes v USING puestos p, empresas e
  WHERE v.puesto_id = p.id AND p.empresa_id = e.id
    AND e.nombre = 'BACANAL' AND p.nombre = 'CACHIMBEROS';
DELETE FROM puestos p USING empresas e
  WHERE p.empresa_id = e.id AND e.nombre = 'BACANAL' AND p.nombre = 'CACHIMBEROS';
DELETE FROM etiquetas et USING empresas e
  WHERE et.empresa_id = e.id AND e.nombre = 'BACANAL'
    AND et.tipo = 'DEPARTAMENTO' AND et.nombre = 'Cachimbero';
