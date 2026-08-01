import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listDescuentos } from "@/features/sala/actions/descuentos-actions";

interface DescuentoExport {
  id: string;
  codigo: string;
  ejecucion: string;
  activo: string;
  fechaCreacion: string;
}

const descuentoSchema = z.object({
  id: z.string(),
  codigo: z.string().min(1),
  ejecucion: z.string(),
  activo: z.string(),
  fechaCreacion: z.string(),
});

const schema = descuentoSchema as unknown as RowSchema<DescuentoExport>;

export const descuentosIO: ModuleIO<DescuentoExport> = {
  module: "gerencia",
  submodule: "descuentos",
  label: "Descuentos",
  description: "Políticas de descuentos aplicables.",
  schema,
  uniqueBy: "codigo",
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "codigo", label: "Código", required: true, unique: true },
    { key: "ejecucion", label: "Ejecución" },
    { key: "activo", label: "Activo" },
    { key: "fechaCreacion", label: "Fecha creación", type: "date" },
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
        codigo: String(r.nombre ?? ""),
        ejecucion: String(r.tipo ?? ""),
        activo: r.activo === false ? "No" : "Sí",
        fechaCreacion: typeof r.created_at === "string" ? r.created_at.slice(0, 10) : "",
      };
    });
  },
};
