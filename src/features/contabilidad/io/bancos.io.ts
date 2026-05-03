import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { SAMPLE_BANCOS, type BancoConectado } from "@/features/contabilidad/data/contabilidad";

const SINCS = ["MANUAL", "AUTOMATICA"] as const;

const bancoSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  productos: z.number(),
  sincronizacion: z.enum(SINCS),
  ultimaSync: z.string(),
  color: z.string(),
});

const schema = bancoSchema as unknown as RowSchema<BancoConectado>;

export const bancosIO: ModuleIO<BancoConectado> = {
  module: "contabilidad",
  submodule: "bancos",
  label: "Bancos conectados",
  description: "Cuentas bancarias y configuración de sincronización.",
  schema,
  uniqueBy: "nombre",
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "nombre", label: "Nombre", required: true, unique: true, example: "BBVA" },
    { key: "productos", label: "Productos", type: "number" },
    { key: "sincronizacion", label: "Sincronización", type: "enum", values: SINCS },
    { key: "ultimaSync", label: "Última sync", type: "date" },
    { key: "color", label: "Color" },
  ],
  fetchAll: async () => SAMPLE_BANCOS,
};
