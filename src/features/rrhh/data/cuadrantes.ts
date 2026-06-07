// Cuadrante (RRHH): ámbito guardado de planificación = un local (o todos) +
// uno o varios departamentos. Vive encima de "Turnos" en /rrhh/horarios.
// El recuento de empleados se calcula sobre la marcha (empleados del ámbito
// que tienen algún turno asignado, directo o vía patrón), no se persiste.

export interface Cuadrante {
  id: string;
  nombre: string;
  /** null = todos los locales de la empresa. */
  localId: string | null;
  /** Nombre del local resuelto para la UI (null cuando aplica a todos). */
  localNombre: string | null;
  departamentoIds: string[];
  activo: boolean;
  /** Empleados del ámbito (local + departamentos) que tienen turno. */
  empleadosCount: number;
}
