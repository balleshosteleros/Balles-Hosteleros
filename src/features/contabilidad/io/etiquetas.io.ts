import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import {
  SAMPLE_ETIQUETAS,
  CATEGORIAS_ETIQUETA,
  type EtiquetaContable,
} from "@/features/contabilidad/data/contabilidad";

const etiquetaSchema = z.object({
  id: z.string(),
  nombre: z.string().min(1),
  categoria: z.string(),
  color: z.string(),
  badgeClass: z.string(),
  usos: z.number(),
});

const schema = etiquetaSchema as unknown as RowSchema<EtiquetaContable>;

export const etiquetasContablesIO: ModuleIO<EtiquetaContable> = {
  module: "contabilidad",
  submodule: "etiquetas",
  label: "Etiquetas contables",
  description: "Catálogo de etiquetas para clasificar transacciones y facturas.",
  schema,
  uniqueBy: "nombre",
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "nombre", label: "Nombre", required: true, unique: true, example: "Marketing digital" },
    { key: "categoria", label: "Categoría", type: "enum", values: CATEGORIAS_ETIQUETA, example: "Marketing" },
    { key: "color", label: "Color" },
    { key: "badgeClass", label: "Estilo badge", hideInImport: true },
    { key: "usos", label: "Usos", type: "number", hideInImport: true },
  ],
  fetchAll: async () => SAMPLE_ETIQUETAS,
};
