import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listReuniones } from "@/features/reuniones/actions/reuniones-actions";

interface ReunionExport {
  id: string;
  titulo: string;
  fecha: string;
  duracion: string;
  participantes: string[];
  meetLink: string;
  notas: string;
}

const reunionSchema = z.object({
  id: z.string(),
  titulo: z.string().min(1),
  fecha: z.string(),
  duracion: z.string(),
  participantes: z.array(z.string()),
  meetLink: z.string(),
  notas: z.string(),
});

const schema = reunionSchema as unknown as RowSchema<ReunionExport>;

export const reunionesIO: ModuleIO<ReunionExport> = {
  module: "reuniones",
  submodule: "reuniones",
  label: "Reuniones",
  description: "Reuniones programadas con participantes y notas.",
  schema,
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "titulo", label: "Título", required: true },
    { key: "fecha", label: "Fecha", type: "date", required: true },
    { key: "duracion", label: "Duración" },
    { key: "participantes", label: "Participantes", type: "array" },
    { key: "meetLink", label: "Enlace" },
    { key: "notas", label: "Notas" },
  ],
  fetchAll: async () => {
    const result = await listReuniones();
    const ok = (result as { ok?: boolean }).ok;
    const data = (result as { data?: unknown }).data;
    if (!ok || !Array.isArray(data)) return [];
    return data.map<ReunionExport>((r) => {
      const m = r as Record<string, unknown>;
      return {
        id: String(m.id ?? ""),
        titulo: String(m.titulo ?? ""),
        fecha: typeof m.fecha === "string" ? m.fecha.slice(0, 10) : "",
        duracion: String(m.duracion ?? ""),
        participantes: Array.isArray(m.participantes) ? m.participantes.map(String) : [],
        meetLink: String(m.meet_link ?? ""),
        notas: String(m.notas ?? ""),
      };
    });
  },
};
