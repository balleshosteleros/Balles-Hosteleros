import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listarMisSolicitudes } from "@/features/mi-panel/actions/mi-panel-actions";

interface SolicitudExport {
  id: string;
  tipo: string;
  estado: string;
  fechaInicio: string;
  fechaFin: string;
  motivo: string;
  fechaCreacion: string;
}

const solicitudSchema = z.object({
  id: z.string(),
  tipo: z.string(),
  estado: z.string(),
  fechaInicio: z.string(),
  fechaFin: z.string(),
  motivo: z.string(),
  fechaCreacion: z.string(),
});

const schema = solicitudSchema as unknown as RowSchema<SolicitudExport>;

export const misSolicitudesIO: ModuleIO<SolicitudExport> = {
  module: "mi-panel",
  submodule: "mis-solicitudes",
  label: "Mis solicitudes",
  description: "Solicitudes personales (vacaciones, permisos, etc.).",
  schema,
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "tipo", label: "Tipo" },
    { key: "estado", label: "Estado" },
    { key: "fechaInicio", label: "Fecha inicio", type: "date" },
    { key: "fechaFin", label: "Fecha fin", type: "date" },
    { key: "motivo", label: "Motivo" },
    { key: "fechaCreacion", label: "Fecha creación", type: "date" },
  ],
  fetchAll: async () => {
    const result = await listarMisSolicitudes();
    const ok = (result as { ok?: boolean }).ok;
    const data = (result as { data?: unknown }).data;
    if (!ok || !Array.isArray(data)) return [];
    return data.map<SolicitudExport>((s) => {
      const r = s as Record<string, unknown>;
      return {
        id: String(r.id ?? ""),
        tipo: String(r.tipo ?? ""),
        estado: String(r.estado ?? ""),
        fechaInicio: String(r.fecha_inicio ?? r.fechaInicio ?? ""),
        fechaFin: String(r.fecha_fin ?? r.fechaFin ?? ""),
        motivo: String(r.motivo ?? ""),
        fechaCreacion: typeof r.created_at === "string" ? r.created_at.slice(0, 10) : "",
      };
    });
  },
};
