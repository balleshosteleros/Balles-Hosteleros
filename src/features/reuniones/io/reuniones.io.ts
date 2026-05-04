import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listReuniones } from "@/features/reuniones/actions/reuniones-actions";

interface ReunionExport {
  id: string;
  titulo: string;
  fecha: string;
  hora: string;
  duracion: number;
  organizador: string;
  participantes: string[];
  estado: string;
  notas: string;
}

const reunionSchema = z.object({
  id: z.string(),
  titulo: z.string().min(1),
  fecha: z.string(),
  hora: z.string(),
  duracion: z.number(),
  organizador: z.string(),
  participantes: z.array(z.string()),
  estado: z.string(),
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
    { key: "hora", label: "Hora" },
    { key: "duracion", label: "Duración (min)", type: "number" },
    { key: "organizador", label: "Organizador" },
    { key: "participantes", label: "Participantes", type: "array" },
    { key: "estado", label: "Estado" },
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
        fecha: String(m.fecha ?? ""),
        hora: String(m.hora ?? ""),
        duracion: typeof m.duracion === "number" ? m.duracion : 0,
        organizador: String(m.organizador ?? ""),
        participantes: Array.isArray(m.participantes) ? m.participantes.map(String) : [],
        estado: String(m.estado ?? ""),
        notas: String(m.notas ?? ""),
      };
    });
  },
};
