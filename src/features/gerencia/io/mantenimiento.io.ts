import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listMantenimiento } from "@/features/gerencia/actions/mantenimiento-actions";

interface MantenimientoExport {
  id: string;
  desperfecto: string;
  local: string;
  gravedad: string;
  estado: string;
  reparador: string;
  apuntaDesperfecto: string;
  fecha: string;
  comentarios: string;
}

const mantSchema = z.object({
  id: z.string(),
  desperfecto: z.string().min(1),
  local: z.string(),
  gravedad: z.string(),
  estado: z.string(),
  reparador: z.string(),
  apuntaDesperfecto: z.string(),
  fecha: z.string(),
  comentarios: z.string(),
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
    { key: "desperfecto", label: "Desperfecto", required: true },
    { key: "local", label: "Local" },
    { key: "gravedad", label: "Gravedad" },
    { key: "estado", label: "Estado" },
    { key: "reparador", label: "Reparador" },
    { key: "apuntaDesperfecto", label: "Apunta desperfecto" },
    { key: "fecha", label: "Fecha", type: "date" },
    { key: "comentarios", label: "Comentarios" },
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
        desperfecto: String(r.desperfecto ?? ""),
        local: String(r.local_nombre ?? ""),
        gravedad: String(r.gravedad ?? ""),
        estado: String(r.estado ?? ""),
        reparador: String(r.reparador ?? ""),
        apuntaDesperfecto: String(r.apunta_desperfecto ?? ""),
        fecha: typeof r.fecha_publicado === "string" ? r.fecha_publicado.slice(0, 10)
          : typeof r.created_at === "string" ? r.created_at.slice(0, 10) : "",
        comentarios: String(r.comentarios ?? ""),
      };
    });
  },
};
