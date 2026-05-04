import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listFacturas } from "@/features/contabilidad/actions/contabilidad-actions";
import type { FacturaContable } from "@/features/contabilidad/data/contabilidad";

const facturaSchema = z.object({
  id: z.string(),
  tipo: z.enum(["COMPRA", "VENTA"]),
  cliente: z.string(),
  numeroFactura: z.string(),
  tipoFactura: z.string(),
  fechaEmision: z.string(),
  fechaPago: z.string(),
  estado: z.enum(["PENDIENTE", "PAGADO", "VENCIDO", "COBRADO"]),
  total: z.number(),
  diasTarde: z.number().optional(),
});

const schema = facturaSchema as unknown as RowSchema<FacturaContable>;

export const facturasIO: ModuleIO<FacturaContable> = {
  module: "contabilidad",
  submodule: "facturas",
  label: "Facturas",
  description: "Facturas de compra y venta.",
  schema,
  uniqueBy: "numeroFactura",
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "numeroFactura", label: "Nº Factura", required: true, unique: true, example: "F2025/001" },
    { key: "tipo", label: "Tipo", type: "enum", values: ["COMPRA", "VENTA"], required: true },
    { key: "cliente", label: "Cliente / Proveedor", required: true },
    { key: "tipoFactura", label: "Tipo factura" },
    { key: "fechaEmision", label: "Fecha emisión", type: "date" },
    { key: "fechaPago", label: "Fecha pago", type: "date" },
    { key: "estado", label: "Estado", type: "enum", values: ["PENDIENTE", "PAGADO", "VENCIDO", "COBRADO"] },
    { key: "total", label: "Total", type: "number", example: "1250.50" },
    { key: "diasTarde", label: "Días retraso", type: "number" },
  ],
  fetchAll: async () => {
    const result = await listFacturas();
    if (!result.ok) return [];
    return (result.data ?? []) as FacturaContable[];
  },
};
