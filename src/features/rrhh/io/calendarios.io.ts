import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { getVacacionesPorEmpresa, type Vacacion } from "@/features/rrhh/data/calendarios";

const ESTADOS = ["aprobada", "pendiente", "rechazada"] as const;

const vacacionSchema = z.object({
  id: z.string(),
  empleadoId: z.string(),
  empleadoNombre: z.string(),
  departamento: z.string(),
  fechaInicio: z.string(),
  fechaFin: z.string(),
  dias: z.number(),
  estado: z.enum(ESTADOS),
  observaciones: z.string().optional(),
});

const schema = vacacionSchema as unknown as RowSchema<Vacacion>;

export const vacacionesIO: ModuleIO<Vacacion> = {
  module: "rrhh",
  submodule: "calendarios-vacaciones",
  label: "Vacaciones",
  description: "Solicitudes y aprobaciones de vacaciones.",
  schema,
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "empleadoNombre", label: "Empleado", required: true },
    { key: "departamento", label: "Departamento" },
    { key: "fechaInicio", label: "Fecha inicio", type: "date", required: true },
    { key: "fechaFin", label: "Fecha fin", type: "date", required: true },
    { key: "dias", label: "Días", type: "number" },
    { key: "estado", label: "Estado", type: "enum", values: ESTADOS },
    { key: "observaciones", label: "Observaciones" },
    { key: "empleadoId", label: "ID Empleado", hideInImport: true },
  ],
  fetchAll: async (ctx) => getVacacionesPorEmpresa((ctx.empresaId as string) ?? ""),
};
