import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import {
  getEmpleadosActivos,
  type EmpleadoActivo,
} from "@/features/rrhh/actions/empleados-actions";

// OLA2-01: el IO de empleados exporta la fuente real (getEmpleadosActivos), no el
// mock de data/rrhh.ts. El alta de empleados tiene su propio flujo real
// (createEmpleado en empleados-actions), por lo que este IO queda como export de
// la plantilla real por empresa. Schema/columnas recortados a los campos reales.
const empleadoSchema = z.object({
  empleadoId: z.string(),
  nombre: z.string().min(1, "El nombre es obligatorio"),
  apellidos: z.string(),
  nombreCompleto: z.string(),
  departamento: z.string().nullable(),
  area: z.string(),
  puesto: z.string().nullable(),
  estado: z.string(),
});

const schema = empleadoSchema as unknown as RowSchema<EmpleadoActivo>;

export const empleadosIO: ModuleIO<EmpleadoActivo> = {
  module: "rrhh",
  submodule: "empleados",
  label: "Empleados",
  description: "Plantilla de empleados (datos reales por empresa).",
  schema,
  uniqueBy: "empleadoId",
  columns: [
    { key: "empleadoId", label: "ID", hideInImport: true },
    { key: "nombreCompleto", label: "Empleado", hideInImport: true },
    { key: "nombre", label: "Nombre", required: true, example: "María" },
    { key: "apellidos", label: "Apellidos", example: "García López" },
    { key: "departamento", label: "Departamento", example: "COCINA" },
    { key: "area", label: "Área", hideInImport: true },
    { key: "puesto", label: "Puesto", example: "Camarera" },
    { key: "estado", label: "Estado", hideInImport: true },
  ],
  // Export de la empresa activa (resuelta server-side). Import deshabilitado:
  // el alta real vive en createEmpleado.
  fetchAll: async () => {
    const res = await getEmpleadosActivos();
    return res.ok ? res.data : [];
  },
};
