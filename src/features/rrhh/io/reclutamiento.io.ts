import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { getVacantesPorEmpresa, type Vacante } from "@/features/rrhh/data/reclutamiento";

const ESTADOS_PUBLICACION = ["publicada", "borrador", "cerrada", "archivada"] as const;

const vacanteSchema = z.object({
  id: z.string(),
  puesto: z.string(),
  categoria: z.string(),
  ubicacion: z.string(),
  tipoJornada: z.string(),
  estadoPublicacion: z.enum(ESTADOS_PUBLICACION),
  fechaCreacion: z.string(),
  cuestionario: z.boolean(),
  reclutadores: z.array(z.string()),
  favorita: z.boolean(),
  candidatos: z.array(z.unknown()),
  empresaId: z.string(),
});

const schema = vacanteSchema as unknown as RowSchema<Vacante>;

export const reclutamientoIO: ModuleIO<Vacante> = {
  module: "rrhh",
  submodule: "reclutamiento",
  label: "Vacantes",
  description: "Procesos de selección con candidatos.",
  schema,
  uniqueBy: "puesto",
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "puesto", label: "Puesto", required: true, unique: true },
    { key: "categoria", label: "Categoría" },
    { key: "ubicacion", label: "Ubicación" },
    { key: "tipoJornada", label: "Jornada" },
    { key: "estadoPublicacion", label: "Estado", type: "enum", values: ESTADOS_PUBLICACION },
    { key: "fechaCreacion", label: "Fecha creación", type: "date" },
    { key: "cuestionario", label: "Tiene cuestionario", type: "boolean" },
    { key: "favorita", label: "Favorita", type: "boolean" },
    { key: "reclutadores", label: "Reclutadores", type: "array" },
    { key: "candidatos", label: "Candidatos", hideInExport: true, hideInImport: true },
    { key: "empresaId", label: "Empresa", hideInImport: true },
  ],
  fetchAll: async (ctx) => getVacantesPorEmpresa((ctx.empresaId as string) ?? ""),
};
