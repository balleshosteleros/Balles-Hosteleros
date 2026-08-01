import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listComunicados } from "@/features/gerencia/actions/comunicados-actions";

interface ComunicadoExport {
  id: string;
  titulo: string;
  asunto: string;
  cuerpo: string;
  estado: string;
  prioridad: string;
  recurrencia: string;
  envio: string;
  observaciones: string;
  fecha: string;
}

const comunicadoSchema = z.object({
  id: z.string(),
  titulo: z.string().min(1),
  asunto: z.string(),
  cuerpo: z.string(),
  estado: z.string(),
  prioridad: z.string(),
  recurrencia: z.string(),
  envio: z.string(),
  observaciones: z.string(),
  fecha: z.string(),
});

const schema = comunicadoSchema as unknown as RowSchema<ComunicadoExport>;

export const comunicadosIO: ModuleIO<ComunicadoExport> = {
  module: "gerencia",
  submodule: "comunicados",
  label: "Comunicados",
  description: "Comunicados internos de la dirección.",
  schema,
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "titulo", label: "Título", required: true },
    { key: "asunto", label: "Asunto" },
    { key: "estado", label: "Estado" },
    { key: "prioridad", label: "Prioridad" },
    { key: "recurrencia", label: "Recurrencia" },
    { key: "envio", label: "Envío programado" },
    { key: "fecha", label: "Fecha", type: "date" },
    { key: "cuerpo", label: "Cuerpo" },
    { key: "observaciones", label: "Observaciones" },
  ],
  fetchAll: async () => {
    const result = await listComunicados();
    const ok = (result as { ok?: boolean }).ok;
    const data = (result as { data?: unknown }).data;
    if (!ok || !Array.isArray(data)) return [];
    return data.map<ComunicadoExport>((c) => {
      const r = c as Record<string, unknown>;
      return {
        id: String(r.id ?? ""),
        titulo: String(r.titulo ?? ""),
        asunto: String(r.asunto ?? ""),
        cuerpo: String(r.cuerpo ?? ""),
        estado: String(r.estado ?? ""),
        prioridad: String(r.prioridad ?? ""),
        recurrencia: String(r.recurrencia ?? ""),
        envio: String(r.envio ?? ""),
        observaciones: String(r.observaciones ?? ""),
        fecha: typeof r.created_at === "string" ? r.created_at.slice(0, 10) : "",
      };
    });
  },
};
