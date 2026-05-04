import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listComunicados } from "@/features/gerencia/actions/comunicados-actions";

interface ComunicadoExport {
  id: string;
  titulo: string;
  contenido: string;
  destinatarios: string;
  fecha: string;
  prioridad: string;
}

const comunicadoSchema = z.object({
  id: z.string(),
  titulo: z.string().min(1),
  contenido: z.string(),
  destinatarios: z.string(),
  fecha: z.string(),
  prioridad: z.string(),
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
    { key: "fecha", label: "Fecha", type: "date" },
    { key: "prioridad", label: "Prioridad" },
    { key: "destinatarios", label: "Destinatarios" },
    { key: "contenido", label: "Contenido" },
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
        contenido: String(r.contenido ?? r.mensaje ?? ""),
        destinatarios: String(r.destinatarios ?? ""),
        fecha: typeof r.created_at === "string" ? r.created_at.slice(0, 10) : String(r.fecha ?? ""),
        prioridad: String(r.prioridad ?? ""),
      };
    });
  },
};
