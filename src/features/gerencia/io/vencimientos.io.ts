import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listVencimientos } from "@/features/gerencia/actions/vencimientos-actions";

interface VencimientoExport {
  id: string;
  concepto: string;
  tipo: string;
  fechaVencimiento: string;
  estado: string;
  descripcion: string;
}

const vencimientoSchema = z.object({
  id: z.string(),
  concepto: z.string().min(1),
  tipo: z.string(),
  fechaVencimiento: z.string(),
  estado: z.string(),
  descripcion: z.string(),
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
    { key: "tipo", label: "Tipo" },
    { key: "fechaVencimiento", label: "Fecha vencimiento", type: "date", required: true },
    { key: "estado", label: "Estado" },
    { key: "descripcion", label: "Descripción" },
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
        concepto: String(r.titulo ?? ""),
        tipo: String(r.tipo ?? ""),
        fechaVencimiento: typeof r.fecha_vencimiento === "string" ? r.fecha_vencimiento.slice(0, 10) : "",
        estado: String(r.estado ?? ""),
        descripcion: String(r.descripcion ?? ""),
      };
    });
  },
};
