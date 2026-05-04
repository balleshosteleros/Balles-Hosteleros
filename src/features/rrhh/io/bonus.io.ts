import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { getBonusPorEmpresa, type Bonus } from "@/features/rrhh/data/bonus";

const ESTADOS = ["activo", "inactivo", "borrador", "archivado"] as const;
const PERIODICIDADES = ["mensual", "trimestral", "semestral", "anual", "puntual"] as const;

const bonusSchema = z.object({
  id: z.string(),
  empresaId: z.string(),
  nombre: z.string(),
  tipo: z.string(),
  descripcion: z.string(),
  objetivo: z.string(),
  explicacion: z.string(),
  estado: z.enum(ESTADOS),
  periodicidad: z.enum(PERIODICIDADES),
  destinatarios: z.object({ tipo: z.string(), ids: z.array(z.string()) }),
  destinatariosTexto: z.string(),
  tablas: z.array(z.unknown()),
});

const schema = bonusSchema as unknown as RowSchema<Bonus>;

export const bonusIO: ModuleIO<Bonus> = {
  module: "rrhh",
  submodule: "bonus",
  label: "Bonus",
  description: "Programas de bonus y comisiones para empleados.",
  schema,
  uniqueBy: "nombre",
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "nombre", label: "Nombre", required: true, unique: true },
    { key: "tipo", label: "Tipo" },
    { key: "estado", label: "Estado", type: "enum", values: ESTADOS },
    { key: "periodicidad", label: "Periodicidad", type: "enum", values: PERIODICIDADES },
    { key: "objetivo", label: "Objetivo" },
    { key: "descripcion", label: "Descripción" },
    { key: "explicacion", label: "Explicación" },
    { key: "destinatariosTexto", label: "Destinatarios" },
    { key: "destinatarios", label: "Destinatarios (estructura)", hideInExport: true, hideInImport: true },
    { key: "tablas", label: "Tablas tramos", hideInExport: true, hideInImport: true },
    { key: "empresaId", label: "Empresa", hideInImport: true },
  ],
  fetchAll: async (ctx) => getBonusPorEmpresa((ctx.empresaId as string) ?? ""),
};
