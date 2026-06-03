import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { type ProcesoBoarding } from "@/features/rrhh/data/boarding";
import { listProcesos } from "@/features/rrhh/actions/boarding-actions";

const TIPOS = ["onboarding", "offboarding"] as const;
const ESTADOS = ["activo", "finalizado", "archivado"] as const;

const procesoSchema = z.object({
  id: z.string(),
  empleadoId: z.string(),
  tipo: z.enum(TIPOS),
  estado: z.enum(ESTADOS),
  plantillaId: z.string(),
  plantillaNombre: z.string(),
  fechaInicio: z.string(),
  empresaId: z.string(),
  tareas: z.array(z.unknown()),
});

const schema = procesoSchema as unknown as RowSchema<ProcesoBoarding>;

export const boardingIO: ModuleIO<ProcesoBoarding> = {
  module: "rrhh",
  submodule: "boarding",
  label: "Onboarding / Offboarding",
  description: "Procesos de incorporación y salida de empleados.",
  schema,
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "empleadoId", label: "ID Empleado", required: true },
    { key: "tipo", label: "Tipo", type: "enum", values: TIPOS, required: true },
    { key: "estado", label: "Estado", type: "enum", values: ESTADOS },
    { key: "plantillaNombre", label: "Plantilla" },
    { key: "fechaInicio", label: "Fecha inicio", type: "date" },
    { key: "plantillaId", label: "ID plantilla", hideInImport: true },
    { key: "tareas", label: "Tareas", hideInExport: true, hideInImport: true },
    { key: "empresaId", label: "Empresa", hideInImport: true },
  ],
  // OLA2-04: exporta los procesos reales de la empresa activa (resuelta
  // server-side por la action), no el mock.
  fetchAll: async () => {
    const res = await listProcesos();
    return res.ok ? res.data : [];
  },
};
