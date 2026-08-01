import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listPresentaciones } from "@/features/gestoria/actions/presentaciones-actions";

interface PresentacionExport {
  id: string;
  modelo: string;
  tipo: string;
  periodo: string;
  estado: string;
  fechaLimite: string;
  fechaPresentacion: string;
  notas: string;
}

const presSchema = z.object({
  id: z.string(),
  modelo: z.string(),
  tipo: z.string(),
  periodo: z.string(),
  estado: z.string(),
  fechaLimite: z.string(),
  fechaPresentacion: z.string(),
  notas: z.string(),
});

const schema = presSchema as unknown as RowSchema<PresentacionExport>;

export const presentacionesGestoriaIO: ModuleIO<PresentacionExport> = {
  module: "gestoria",
  submodule: "presentaciones",
  label: "Presentaciones a hacienda",
  description: "Modelos fiscales presentados (303, 347, etc.).",
  schema,
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "modelo", label: "Modelo", required: true, example: "303" },
    { key: "tipo", label: "Tipo" },
    { key: "periodo", label: "Período", example: "2026-T1" },
    { key: "estado", label: "Estado" },
    { key: "fechaLimite", label: "Fecha límite", type: "date" },
    { key: "fechaPresentacion", label: "Fecha presentación", type: "date" },
    { key: "notas", label: "Notas" },
  ],
  fetchAll: async () => {
    const result = await listPresentaciones();
    const ok = (result as { ok?: boolean }).ok;
    const data = (result as { data?: unknown }).data;
    if (!ok || !Array.isArray(data)) return [];
    return data.map<PresentacionExport>((p) => {
      const r = p as Record<string, unknown>;
      return {
        id: String(r.id ?? ""),
        modelo: String(r.titulo ?? ""),
        tipo: String(r.tipo ?? ""),
        periodo: String(r.periodo ?? ""),
        estado: String(r.estado ?? ""),
        fechaLimite: typeof r.fecha_limite === "string" ? r.fecha_limite.slice(0, 10) : "",
        fechaPresentacion: typeof r.fecha_presentacion === "string" ? r.fecha_presentacion.slice(0, 10) : "",
        notas: String(r.notas ?? ""),
      };
    });
  },
};
