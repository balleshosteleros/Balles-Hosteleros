-- Color por departamento (configurable por empresa).
-- El color es la fuente única de tinte de los turnos en el cuadrante de horarios:
-- todos los turnos y empleados de un mismo departamento se pintan con este color.
-- La paleta por defecto es canónica (src/lib/seeds/departamentos.ts) pero cada
-- empresa puede editarla en Ajustes → RRHH → Horarios → Colores de departamento.

ALTER TABLE departamentos
  ADD COLUMN IF NOT EXISTS color TEXT;

-- Paleta canónica por defecto (hex). Distinta por departamento; coincide con la
-- semántica ya visible (Sala verde, Cocina ámbar, Artistas morado, Contabilidad
-- gris). Solo se aplica donde aún no hay color, para no pisar personalizaciones.
UPDATE departamentos AS d
SET color = c.color
FROM (VALUES
  ('DIRECCIÓN',        '#4f46e5'),
  ('GERENCIA',         '#7c3aed'),
  ('RECURSOS HUMANOS', '#e11d48'),
  ('CALIDAD',          '#0d9488'),
  ('CONTABILIDAD',     '#64748b'),
  ('LOGÍSTICA',        '#ea580c'),
  ('MARKETING',        '#db2777'),
  ('GESTORÍA',         '#0284c7'),
  ('JURÍDICO',         '#57534e'),
  ('SALA',             '#10b981'),
  ('COCINA',           '#f59e0b'),
  ('ARTISTAS',         '#a855f7'),
  ('MANTENIMIENTO',    '#84cc16')
) AS c(nombre, color)
WHERE upper(btrim(d.nombre)) = c.nombre
  AND d.color IS NULL;

-- Cualquier departamento ajeno al catálogo canónico que quede sin color hereda
-- un gris neutro para no romper el render.
UPDATE departamentos SET color = '#6b7280' WHERE color IS NULL;
