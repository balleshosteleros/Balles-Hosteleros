export type EstadoEmpleadoUI = "Activo" | "Inactivo";

export interface EmpleadoUI {
  id: string;
  nombre: string;
  apellidos: string;
  avatar?: string;
  estado: EstadoEmpleadoUI;
  horarioTipo: string;
  horarioSemanal: string;
  horasHoy: string;
  puesto: string;
  departamento: string;
  areas: string[];
  telefono: string;
  emailEmpresa: string;
  emailPersonal: string;
  /** Departamento que valida sus solicitudes ("—" si no está definido). */
  validador: string;
}

export const ESTADOS_LABEL: Record<EstadoEmpleadoUI, string> = {
  Activo: "Activo",
  Inactivo: "Inactivo",
};

export const ESTADOS_COLOR: Record<EstadoEmpleadoUI, string> = {
  Activo: "bg-emerald-500",
  Inactivo: "bg-destructive",
};
