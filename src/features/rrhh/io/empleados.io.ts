import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import {
  getEmpleadosPorEmpresa,
  type Empleado,
} from "@/features/rrhh/data/rrhh";

const empleadoSchema = z.object({
  id: z.string(),
  nombre: z.string().min(1, "El nombre es obligatorio"),
  apellidos: z.string(),
  estado: z.string(),
  horarioTipo: z.string(),
  horarioSemanal: z.string(),
  horasHoy: z.string(),
  departamento: z.string(),
  telefono: z.string(),
  fichajes: z.number(),
  emailEmpresa: z.string(),
  emailPersonal: z.string(),
  validadorFichajes: z.string(),
});

const schema = empleadoSchema as unknown as RowSchema<Empleado>;

export const empleadosIO: ModuleIO<Empleado> = {
  module: "rrhh",
  submodule: "empleados",
  label: "Empleados",
  description: "Plantilla de empleados con datos personales, contacto y estado.",
  schema,
  uniqueBy: "emailEmpresa",
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "nombre", label: "Nombre", required: true, example: "María" },
    { key: "apellidos", label: "Apellidos", example: "García López" },
    { key: "departamento", label: "Departamento", example: "COCINA" },
    { key: "estado", label: "Estado" },
    { key: "horarioTipo", label: "Tipo de horario" },
    { key: "horarioSemanal", label: "Horas/semana" },
    { key: "horasHoy", label: "Horas hoy", hideInImport: true },
    { key: "telefono", label: "Teléfono", example: "612345678" },
    { key: "emailEmpresa", label: "Email empresa", aliases: ["correo empresa"], unique: true },
    { key: "emailPersonal", label: "Email personal" },
    { key: "validadorFichajes", label: "Validador fichajes" },
    { key: "fichajes", label: "Fichajes hoy", type: "number", hideInImport: true },
  ],
  fetchAll: async (ctx) => {
    const empresaId = (ctx.empresaId as string) ?? "";
    return getEmpleadosPorEmpresa(empresaId);
  },
};
