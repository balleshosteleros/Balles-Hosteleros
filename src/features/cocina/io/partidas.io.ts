import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { getPartidasByEmpresa, type Partida } from "@/features/cocina/data/partidas";

const partidaSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  area: z.string(),
  estado: z.string(),
  creador: z.string(),
  fechaActualizacion: z.string(),
  productos: z.array(z.unknown()),
  misEnPlace: z.array(z.unknown()),
});

const schema = partidaSchema as unknown as RowSchema<Partida>;

export const partidasIO: ModuleIO<Partida> = {
  module: "cocina",
  submodule: "partidas",
  label: "Partidas de cocina",
  description: "Partidas con productos y mise en place.",
  schema,
  uniqueBy: "nombre",
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "nombre", label: "Nombre", required: true, unique: true, example: "Fríos" },
    { key: "area", label: "Área", required: true, example: "COCINA" },
    { key: "estado", label: "Estado" },
    { key: "creador", label: "Creador" },
    { key: "fechaActualizacion", label: "Actualizado", type: "date", hideInImport: true },
    { key: "productos", label: "Productos", hideInExport: true, hideInImport: true },
    { key: "misEnPlace", label: "Mise en place", hideInExport: true, hideInImport: true },
  ],
  fetchAll: async (ctx) => getPartidasByEmpresa((ctx.empresaId as string) ?? ""),
};
