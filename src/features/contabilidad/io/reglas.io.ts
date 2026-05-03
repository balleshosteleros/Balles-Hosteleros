import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import {
  SAMPLE_REGLAS,
  type ReglaAutomatica,
} from "@/features/contabilidad/data/contabilidad";

const PRIORIDADES = ["ALTA", "MEDIA", "BAJA"] as const;

const reglaSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  condicionTexto: z.string(),
  accionTexto: z.string(),
  prioridad: z.enum(PRIORIDADES),
  activa: z.boolean(),
});

const schema = reglaSchema as unknown as RowSchema<ReglaAutomatica>;

export const reglasIO: ModuleIO<ReglaAutomatica> = {
  module: "contabilidad",
  submodule: "reglas",
  label: "Reglas automáticas",
  description: "Reglas de etiquetado y categorización automática de transacciones.",
  schema,
  uniqueBy: "nombre",
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "nombre", label: "Nombre", required: true, unique: true },
    { key: "prioridad", label: "Prioridad", type: "enum", values: PRIORIDADES },
    { key: "activa", label: "Activa", type: "boolean" },
    { key: "condicionTexto", label: "Condición" },
    { key: "accionTexto", label: "Acción" },
  ],
  fetchAll: async () => SAMPLE_REGLAS,
};
