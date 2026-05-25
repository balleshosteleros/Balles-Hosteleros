import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listTarifas } from "@/features/logistica/actions/tarifas-actions";

interface TarifaExport {
  nombre: string;
  descripcion: string | null;
  esDefault: boolean;
  activa: boolean;
  orden: number;
}

const tarifaSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  descripcion: z.string().nullable().optional(),
  esDefault: z.boolean().optional(),
  activa: z.boolean().optional(),
  orden: z.number().optional(),
});

const schema = tarifaSchema as unknown as RowSchema<TarifaExport>;

export const tarifasIO: ModuleIO<TarifaExport> = {
  module: "logistica",
  submodule: "tarifas",
  label: "Tarifas",
  description: "Listas de precios disponibles para los productos de venta.",
  schema,
  uniqueBy: "nombre",
  columns: [
    { key: "nombre", label: "Nombre", required: true, unique: true, example: "Terraza" },
    { key: "descripcion", label: "Descripción", example: "Precios de terraza en verano" },
    { key: "esDefault", label: "Default", type: "boolean" },
    { key: "activa", label: "Activa", type: "boolean" },
    { key: "orden", label: "Orden", type: "number" },
  ],
  fetchAll: async () => {
    const result = await listTarifas();
    const rows = result.ok ? result.data : [];
    return rows.map<TarifaExport>((t) => ({
      nombre: t.nombre,
      descripcion: t.descripcion,
      esDefault: t.esDefault,
      activa: t.activa,
      orden: t.orden,
    }));
  },
};
