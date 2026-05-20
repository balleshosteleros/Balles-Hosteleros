export type EstadoEmpleadoUI = "Activo" | "Baja temporal" | "Baja definitiva";

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
  "Baja temporal": "Baja temporal",
  "Baja definitiva": "Baja definitiva",
};

export const ESTADOS_COLOR: Record<EstadoEmpleadoUI, string> = {
  Activo: "bg-emerald-500",
  "Baja temporal": "bg-amber-400",
  "Baja definitiva": "bg-destructive",
};
