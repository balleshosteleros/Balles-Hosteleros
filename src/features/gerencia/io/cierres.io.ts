import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listCierres } from "@/features/gerencia/actions/cierres-actions";

interface CierreExport {
  id: string;
  fecha: string;
  tipo: string;
  total: number;
  efectivo: number;
  tarjeta: number;
  observaciones: string;
}

const cierreSchema = z.object({
  id: z.string(),
  fecha: z.string(),
  tipo: z.string(),
  total: z.number(),
  efectivo: z.number(),
  tarjeta: z.number(),
  observaciones: z.string(),
});

const schema = cierreSchema as unknown as RowSchema<CierreExport>;

export const cierresIO: ModuleIO<CierreExport> = {
  module: "gerencia",
  submodule: "cierres",
  label: "Cierres de caja",
  description: "Cierres diarios, semanales y mensuales.",
  schema,
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "fecha", label: "Fecha", type: "date", required: true },
    { key: "tipo", label: "Tipo" },
    { key: "total", label: "Total", type: "number" },
    { key: "efectivo", label: "Efectivo", type: "number" },
    { key: "tarjeta", label: "Tarjeta", type: "number" },
    { key: "observaciones", label: "Observaciones" },
  ],
  fetchAll: async () => {
    const result = await listCierres();
    if (!result.ok) return [];
    return (result.data ?? []).map<CierreExport>((c) => {
      const r = c as unknown as Record<string, unknown>;
      return {
        id: String(r.id ?? ""),
        fecha: typeof r.fecha === "string" ? r.fecha : "",
        tipo: String(r.tipo ?? ""),
        total: typeof r.total === "number" ? r.total : 0,
        efectivo: typeof r.efectivo === "number" ? r.efectivo : 0,
        tarjeta: typeof r.tarjeta === "number" ? r.tarjeta : 0,
        observaciones: String(r.observaciones ?? ""),
      };
    });
  },
};
