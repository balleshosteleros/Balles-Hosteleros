export type EstadoEmpleadoUI = "Activo" | "Desactivado";

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
  telefono: string;
  fichajes: number;
  emailEmpresa: string;
  emailPersonal: string;
  validadorFichajes: string;
}

export const ESTADOS_LABEL: Record<EstadoEmpleadoUI, string> = {
  Activo: "Activo",
  Desactivado: "Desactivado",
};

export const ESTADOS_COLOR: Record<EstadoEmpleadoUI, string> = {
  Activo: "bg-emerald-500",
  Desactivado: "bg-destructive",
};
