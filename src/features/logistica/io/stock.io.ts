import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listStock } from "@/features/logistica/actions/stock-actions";

interface StockExport {
  producto: string;
  unidad: string;
  cantidad: number | null;
  cantidadMinima: number | null;
  cantidadMaxima: number | null;
  notas: string | null;
}

const stockSchema = z.object({
  producto: z.string(),
  unidad: z.string(),
  cantidad: z.number().nullable(),
  cantidadMinima: z.number().nullable(),
  cantidadMaxima: z.number().nullable(),
  notas: z.string().nullable(),
});

const schema = stockSchema as unknown as RowSchema<StockExport>;

export const stockIO: ModuleIO<StockExport> = {
  module: "logistica",
  submodule: "stock",
  label: "Stock",
  description: "Niveles de stock por producto y almacén.",
  schema,
  columns: [
    { key: "producto", label: "Producto", required: true, unique: true },
    { key: "unidad", label: "Unidad" },
    { key: "cantidad", label: "Cantidad actual", type: "number" },
    { key: "cantidadMinima", label: "Stock mínimo", type: "number" },
    { key: "cantidadMaxima", label: "Stock máximo", type: "number" },
    { key: "notas", label: "Notas" },
  ],
  fetchAll: async () => {
    const result = await listStock();
    const rows = (result.ok ? result.data : []) as Array<Record<string, unknown>>;
    return rows.map<StockExport>((r) => ({
      producto: String(r.producto_nombre ?? r.nombre ?? ""),
      unidad: String(r.unidad ?? "ud"),
      cantidad: typeof r.cantidad === "number" ? r.cantidad : null,
      cantidadMinima: typeof r.cantidad_minima === "number" ? r.cantidad_minima : null,
      cantidadMaxima: typeof r.cantidad_maxima === "number" ? r.cantidad_maxima : null,
      notas: (r.notas as string | null) ?? null,
    }));
  },
};
