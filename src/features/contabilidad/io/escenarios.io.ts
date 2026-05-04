import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import {
  SAMPLE_ESCENARIO,
  type EscenarioMes,
} from "@/features/contabilidad/data/contabilidad";

const escenarioSchema = z.object({
  mes: z.string(),
  entradas: z.number(),
  salidas: z.number(),
  saldo: z.number(),
  actual: z.boolean().optional(),
});

const schema = escenarioSchema as unknown as RowSchema<EscenarioMes>;

export const escenariosIO: ModuleIO<EscenarioMes> = {
  module: "contabilidad",
  submodule: "escenarios",
  label: "Escenarios financieros",
  description: "Proyección mensual de entradas, salidas y saldo.",
  schema,
  uniqueBy: "mes",
  columns: [
    { key: "mes", label: "Mes", required: true, unique: true, example: "Ene 2026" },
    { key: "entradas", label: "Entradas", type: "number", example: "51078" },
    { key: "salidas", label: "Salidas", type: "number", example: "48682" },
    { key: "saldo", label: "Saldo", type: "number" },
    { key: "actual", label: "Actual", type: "boolean" },
  ],
  fetchAll: async () => SAMPLE_ESCENARIO,
};
