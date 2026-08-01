-- Renombra el puesto "COCINEROS" a "COCINERO" (singular) en el catálogo de
-- puestos y en cualquier copia del nombre en empleado_puestos.
-- Idempotente: solo actúa sobre filas que aún estén en plural.

-- 1) Catálogo de puestos (fuente única de la selección de puestos).
update public.puestos
set nombre = 'COCINERO'
where upper(trim(nombre)) = 'COCINEROS';

-- 2) Copias del nombre en la relación empleado↔puesto (por si alguna quedó en plural).
update public.empleado_puestos
set puesto_nombre = 'COCINERO'
where upper(trim(puesto_nombre)) = 'COCINEROS';

-- 3) Columna de respaldo puesto en empleados (misma razón).
update public.empleados
set puesto = 'COCINERO'
where upper(trim(puesto)) = 'COCINEROS';

-- 4) Vacante espejo del puesto (título + snapshot del nombre del puesto).
update public.vacantes
set titulo = 'COCINERO'
where upper(trim(titulo)) = 'COCINEROS';

update public.vacantes
set puesto_snapshot = 'COCINERO'
where upper(trim(puesto_snapshot)) = 'COCINEROS';
