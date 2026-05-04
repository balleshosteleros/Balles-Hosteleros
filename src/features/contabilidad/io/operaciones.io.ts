import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import {
  SAMPLE_OPERACIONES,
  type OperacionContable,
} from "@/features/contabilidad/data/contabilidad";

const PERIODICIDADES = ["MENSUAL", "TRIMESTRAL", "ANUAL", "PUNTUAL", "SEMANAL"] as const;
const TIPOS_OP = ["ENTRADA", "SALIDA"] as const;

const operacionSchema = z.object({
  id: z.string(),
  descripcion: z.string(),
  contacto: z.string(),
  periodicidad: z.enum(PERIODICIDADES),
  fechaInicio: z.string(),
  fechaFin: z.string(),
  total: z.number(),
  tipo: z.enum(TIPOS_OP),
  etiquetas: z.array(z.string()),
});

const schema = operacionSchema as unknown as RowSchema<OperacionContable>;

export const operacionesIO: ModuleIO<OperacionContable> = {
  module: "contabilidad",
  submodule: "operaciones",
  label: "Operaciones contables",
  description: "Operaciones recurrentes y puntuales.",
  schema,
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "descripcion", label: "Descripción", required: true },
    { key: "contacto", label: "Contacto", required: true },
    { key: "tipo", label: "Tipo", type: "enum", values: TIPOS_OP, required: true },
    { key: "periodicidad", label: "Periodicidad", type: "enum", values: PERIODICIDADES },
    { key: "fechaInicio", label: "Fecha inicio", type: "date" },
    { key: "fechaFin", label: "Fecha fin", type: "date" },
    { key: "total", label: "Total", type: "number" },
    { key: "etiquetas", label: "Etiquetas", type: "array" },
  ],
  fetchAll: async () => SAMPLE_OPERACIONES,
};
