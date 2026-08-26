-- Elimina `empleados.numero_empleado`.
--
-- Por qué: no existe como concepto en el negocio. No se veía en ninguna pantalla
-- (cero apariciones en toda la interfaz), no había forma de rellenarlo y no lo
-- usaba ningún informe, contrato ni nómina. Solo se autogeneraba en un caso
-- suelto —copiar un empleado a otra empresa— con un contador por empresa que
-- además producía el MISMO número para la misma persona en cada sociedad
-- (los 2 únicos valores existentes eran «EMP-0001» duplicado).
--
-- Se elimina también ese autogenerado en `copiarEmpleadoAEmpresa`.

ALTER TABLE public.empleados DROP COLUMN IF EXISTS numero_empleado;
