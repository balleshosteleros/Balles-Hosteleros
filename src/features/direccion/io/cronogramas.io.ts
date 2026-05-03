import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { mockCronogramas, type Cronograma } from "@/features/direccion/data/cronogramas";

const cronogramaSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  departamento: z.string(),
  empleados: z.array(z.unknown()),
});

const schema = cronogramaSchema as unknown as RowSchema<Cronograma>;

export const cronogramasIO: ModuleIO<Cronograma> = {
  module: "direccion",
  submodule: "cronogramas",
  label: "Cronogramas operativos",
  description: "Cronogramas de equipos por departamento.",
  schema,
  uniqueBy: "titulo",
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "titulo", label: "Título", required: true, unique: true },
    { key: "departamento", label: "Departamento", required: true },
    { key: "empleados", label: "Empleados", hideInExport: true, hideInImport: true },
  ],
  fetchAll: async () => mockCronogramas,
};
