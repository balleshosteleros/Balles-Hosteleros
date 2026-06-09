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
  departamento: string;
  areas: string[];
  telefono: string;
  fichajes: number;
  emailEmpresa: string;
  emailPersonal: string;
  validadorTrabajo: string;
  validadorAusencias: string;
}

export const ESTADOS_LABEL: Record<EstadoEmpleadoUI, string> = {
  Activo: "Activo",
  Inactivo: "Inactivo",
};

export const ESTADOS_COLOR: Record<EstadoEmpleadoUI, string> = {
  Activo: "bg-emerald-500",
  Inactivo: "bg-destructive",
};
