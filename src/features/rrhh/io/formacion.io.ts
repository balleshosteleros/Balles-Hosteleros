import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { getRutasPorEmpresa, type RutaFormativa } from "@/features/rrhh/data/formacion";

const rutaSchema = z.object({
  id: z.string(),
  puestoId: z.string(),
  puestoNombre: z.string(),
  empresaId: z.string(),
  modulos: z.array(z.unknown()),
});

const schema = rutaSchema as unknown as RowSchema<RutaFormativa>;

export const formacionIO: ModuleIO<RutaFormativa> = {
  module: "rrhh",
  submodule: "formacion",
  label: "Rutas formativas",
  description: "Rutas de formación asignadas por puesto.",
  schema,
  uniqueBy: "puestoNombre",
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "puestoNombre", label: "Puesto", required: true, unique: true },
    { key: "puestoId", label: "ID Puesto", hideInImport: true },
    { key: "modulos", label: "Módulos", hideInExport: true, hideInImport: true },
    { key: "empresaId", label: "Empresa", hideInImport: true },
  ],
  fetchAll: async (ctx) => getRutasPorEmpresa((ctx.empresaId as string) ?? ""),
};
