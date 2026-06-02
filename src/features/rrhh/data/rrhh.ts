// OLA2-01: este archivo dejó de ser fuente de empleados. Los empleados reales
// viven en la tabla `empleados` y se leen vía `getEmpleadosActivos()`
// (src/features/rrhh/actions/empleados-actions.ts). Se retiraron el tipo
// `Empleado` (vista operativa), `EstadoEmpleado`, `ESTADOS_LABEL`/`ESTADOS_COLOR`
// (código muerto: la UI real usa empleados/empleado-ui.ts) y los arrays mock
// de empleados por empresa con su getter síncrono.
//
// Solo se conserva la constante DEPARTAMENTOS, que aún consumen varios
// formularios (Comunicados, Encuestas, Bonus, Reclutamiento). Su unificación con
// los clones de otros módulos (accesos-apps, salarios, roles-empresa) es OLA2-10.

export const DEPARTAMENTOS = [
  "DIRECCIÓN", "GERENTE", "JEFE DE SALA", "CAMAREROS", "COCINA",
  "CACHIMBEROS", "ARTISTAS", "MANTENIMIENTO", "RRPP", "ADMINISTRATIVO",
];
