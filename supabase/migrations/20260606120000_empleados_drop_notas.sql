-- Retira el campo "Notas internas" de empleados: no se usa en ninguna empresa
-- (0/24 filas con datos) y se elimina de la ficha de gestión de empleado.
ALTER TABLE empleados DROP COLUMN IF EXISTS notas;
