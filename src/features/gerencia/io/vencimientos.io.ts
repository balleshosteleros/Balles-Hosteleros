import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listVencimientos } from "@/features/gerencia/actions/vencimientos-actions";

interface VencimientoExport {
  id: string;
  concepto: string;
  fechaVencimiento: string;
  diasAviso: number;
  prioridad: string;
  responsable: string;
  observaciones: string;
}

const vencimientoSchema = z.object({
  id: z.string(),
  concepto: z.string().min(1),
  fechaVencimiento: z.string(),
  diasAviso: z.number(),
  prioridad: z.string(),
  responsable: z.string(),
  observaciones: z.string(),
});

const schema = vencimientoSchema as unknown as RowSchema<VencimientoExport>;

export const vencimientosIO: ModuleIO<VencimientoExport> = {
  module: "gerencia",
  submodule: "vencimientos",
  label: "Vencimientos",
  description: "Alertas de vencimientos de licencias, contratos y documentos.",
  schema,
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "concepto", label: "Concepto", required: true },
    { key: "fechaVencimiento", label: "Fecha vencimiento", type: "date", required: true },
    { key: "diasAviso", label: "Días aviso", type: "number" },
    { key: "prioridad", label: "Prioridad" },
    { key: "responsable", label: "Responsable" },
    { key: "observaciones", label: "Observaciones" },
  ],
  fetchAll: async () => {
    const result = await listVencimientos();
    const ok = (result as { ok?: boolean }).ok;
    const data = (result as { data?: unknown }).data;
    if (!ok || !Array.isArray(data)) return [];
    return data.map<VencimientoExport>((v) => {
      const r = v as Record<string, unknown>;
      return {
        id: String(r.id ?? ""),
        concepto: String(r.concepto ?? ""),
        fechaVencimiento: typeof r.fecha_vencimiento === "string" ? r.fecha_vencimiento : String(r.fechaVencimiento ?? ""),
        diasAviso: typeof r.dias_aviso === "number" ? r.dias_aviso : 0,
        prioridad: String(r.prioridad ?? ""),
        responsable: String(r.responsable ?? ""),
        observaciones: String(r.observaciones ?? ""),
      };
    });
  },
};
