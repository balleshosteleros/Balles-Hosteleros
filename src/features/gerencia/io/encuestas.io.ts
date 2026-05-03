import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listEncuestas } from "@/features/gerencia/actions/encuestas-actions";

interface EncuestaExport {
  id: string;
  titulo: string;
  estado: string;
  fechaInicio: string;
  fechaFin: string;
  respuestas: number;
}

const encuestaSchema = z.object({
  id: z.string(),
  titulo: z.string().min(1),
  estado: z.string(),
  fechaInicio: z.string(),
  fechaFin: z.string(),
  respuestas: z.number(),
});

const schema = encuestaSchema as unknown as RowSchema<EncuestaExport>;

export const encuestasIO: ModuleIO<EncuestaExport> = {
  module: "gerencia",
  submodule: "encuestas",
  label: "Encuestas",
  description: "Encuestas internas y de satisfacción.",
  schema,
  uniqueBy: "titulo",
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "titulo", label: "Título", required: true, unique: true },
    { key: "estado", label: "Estado" },
    { key: "fechaInicio", label: "Fecha inicio", type: "date" },
    { key: "fechaFin", label: "Fecha fin", type: "date" },
    { key: "respuestas", label: "Respuestas", type: "number" },
  ],
  fetchAll: async () => {
    const result = await listEncuestas();
    const ok = (result as { ok?: boolean }).ok;
    const data = (result as { data?: unknown }).data;
    if (!ok || !Array.isArray(data)) return [];
    return data.map<EncuestaExport>((e) => {
      const r = e as Record<string, unknown>;
      return {
        id: String(r.id ?? ""),
        titulo: String(r.titulo ?? r.nombre ?? ""),
        estado: String(r.estado ?? ""),
        fechaInicio: typeof r.fecha_inicio === "string" ? r.fecha_inicio : String(r.fechaInicio ?? ""),
        fechaFin: typeof r.fecha_fin === "string" ? r.fecha_fin : String(r.fechaFin ?? ""),
        respuestas: typeof r.respuestas === "number" ? r.respuestas : 0,
      };
    });
  },
};
