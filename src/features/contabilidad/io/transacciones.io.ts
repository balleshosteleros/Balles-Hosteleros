import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listTransacciones } from "@/features/contabilidad/actions/contabilidad-actions";
import type { TransaccionContable } from "@/features/contabilidad/data/contabilidad";

const transaccionSchema = z.object({
  id: z.string(),
  concepto: z.string(),
  banco: z.string(),
  fecha: z.string(),
  importe: z.number(),
  tipo: z.enum(["COBRO", "PAGO"]),
  etiquetas: z.array(z.unknown()),
  documentos: z.number(),
  conciliada: z.boolean(),
});

const schema = transaccionSchema as unknown as RowSchema<TransaccionContable>;

export const transaccionesIO: ModuleIO<TransaccionContable> = {
  module: "contabilidad",
  submodule: "transacciones",
  label: "Transacciones bancarias",
  description: "Movimientos bancarios (cobros y pagos).",
  schema,
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "concepto", label: "Concepto", required: true, example: "Pago factura F-2025/123" },
    { key: "banco", label: "Banco", required: true },
    { key: "fecha", label: "Fecha", type: "date", required: true },
    { key: "importe", label: "Importe", type: "number", required: true },
    { key: "tipo", label: "Tipo", type: "enum", values: ["COBRO", "PAGO"], required: true },
    { key: "documentos", label: "Documentos adjuntos", type: "number" },
    { key: "conciliada", label: "Conciliada", type: "boolean" },
    { key: "etiquetas", label: "Etiquetas", hideInExport: true, hideInImport: true },
  ],
  fetchAll: async () => {
    const result = await listTransacciones();
    if (!result.ok) return [];
    return (result.data ?? []) as TransaccionContable[];
  },
};
