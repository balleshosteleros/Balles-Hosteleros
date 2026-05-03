import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listMantenimiento } from "@/features/gerencia/actions/mantenimiento-actions";

interface MantenimientoExport {
  id: string;
  titulo: string;
  ubicacion: string;
  prioridad: string;
  estado: string;
  fechaCreacion: string;
  responsable: string;
  descripcion: string;
}

const mantSchema = z.object({
  id: z.string(),
  titulo: z.string().min(1),
  ubicacion: z.string(),
  prioridad: z.string(),
  estado: z.string(),
  fechaCreacion: z.string(),
  responsable: z.string(),
  descripcion: z.string(),
});

const schema = mantSchema as unknown as RowSchema<MantenimientoExport>;

export const mantenimientoIO: ModuleIO<MantenimientoExport> = {
  module: "gerencia",
  submodule: "mantenimiento",
  label: "Incidencias de mantenimiento",
  description: "Incidencias técnicas y reparaciones.",
  schema,
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "titulo", label: "Título", required: true },
    { key: "ubicacion", label: "Ubicación" },
    { key: "prioridad", label: "Prioridad" },
    { key: "estado", label: "Estado" },
    { key: "responsable", label: "Responsable" },
    { key: "fechaCreacion", label: "Fecha creación", type: "date" },
    { key: "descripcion", label: "Descripción" },
  ],
  fetchAll: async () => {
    const result = await listMantenimiento();
    const ok = (result as { ok?: boolean }).ok;
    const data = (result as { data?: unknown }).data;
    if (!ok || !Array.isArray(data)) return [];
    return data.map<MantenimientoExport>((m) => {
      const r = m as Record<string, unknown>;
      return {
        id: String(r.id ?? ""),
        titulo: String(r.titulo ?? ""),
        ubicacion: String(r.ubicacion ?? ""),
        prioridad: String(r.prioridad ?? ""),
        estado: String(r.estado ?? ""),
        fechaCreacion: typeof r.created_at === "string" ? r.created_at.slice(0, 10) : String(r.fechaCreacion ?? ""),
        responsable: String(r.responsable ?? ""),
        descripcion: String(r.descripcion ?? ""),
      };
    });
  },
};
