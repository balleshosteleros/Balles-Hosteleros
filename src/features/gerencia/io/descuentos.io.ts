import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listDescuentos } from "@/features/gerencia/actions/descuentos-actions";

interface DescuentoExport {
  id: string;
  nombre: string;
  tipo: string;
  porcentaje: number;
  estado: string;
  fechaInicio: string;
  fechaFin: string;
  observaciones: string;
}

const descuentoSchema = z.object({
  id: z.string(),
  nombre: z.string().min(1),
  tipo: z.string(),
  porcentaje: z.number(),
  estado: z.string(),
  fechaInicio: z.string(),
  fechaFin: z.string(),
  observaciones: z.string(),
});

const schema = descuentoSchema as unknown as RowSchema<DescuentoExport>;

export const descuentosIO: ModuleIO<DescuentoExport> = {
  module: "gerencia",
  submodule: "descuentos",
  label: "Descuentos",
  description: "Políticas de descuentos aplicables.",
  schema,
  uniqueBy: "nombre",
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "nombre", label: "Nombre", required: true, unique: true },
    { key: "tipo", label: "Tipo" },
    { key: "porcentaje", label: "Porcentaje", type: "number" },
    { key: "estado", label: "Estado" },
    { key: "fechaInicio", label: "Fecha inicio", type: "date" },
    { key: "fechaFin", label: "Fecha fin", type: "date" },
    { key: "observaciones", label: "Observaciones" },
  ],
  fetchAll: async () => {
    const result = await listDescuentos();
    const ok = (result as { ok?: boolean }).ok;
    const data = (result as { data?: unknown }).data;
    if (!ok || !Array.isArray(data)) return [];
    return data.map<DescuentoExport>((d) => {
      const r = d as Record<string, unknown>;
      return {
        id: String(r.id ?? ""),
        nombre: String(r.nombre ?? ""),
        tipo: String(r.tipo ?? ""),
        porcentaje: typeof r.porcentaje === "number" ? r.porcentaje : 0,
        estado: String(r.estado ?? ""),
        fechaInicio: typeof r.fecha_inicio === "string" ? r.fecha_inicio : String(r.fechaInicio ?? ""),
        fechaFin: typeof r.fecha_fin === "string" ? r.fecha_fin : String(r.fechaFin ?? ""),
        observaciones: String(r.observaciones ?? ""),
      };
    });
  },
};
