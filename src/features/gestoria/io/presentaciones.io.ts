import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listPresentaciones } from "@/features/gestoria/actions/presentaciones-actions";

interface PresentacionExport {
  id: string;
  modelo: string;
  periodo: string;
  fechaPresentacion: string;
  importe: number;
  estado: string;
  observaciones: string;
}

const presSchema = z.object({
  id: z.string(),
  modelo: z.string(),
  periodo: z.string(),
  fechaPresentacion: z.string(),
  importe: z.number(),
  estado: z.string(),
  observaciones: z.string(),
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
    { key: "periodo", label: "Período", required: true, example: "2026-T1" },
    { key: "fechaPresentacion", label: "Fecha presentación", type: "date" },
    { key: "importe", label: "Importe", type: "number" },
    { key: "estado", label: "Estado" },
    { key: "observaciones", label: "Observaciones" },
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
        modelo: String(r.modelo ?? ""),
        periodo: String(r.periodo ?? ""),
        fechaPresentacion: typeof r.fecha_presentacion === "string" ? r.fecha_presentacion : String(r.fechaPresentacion ?? ""),
        importe: typeof r.importe === "number" ? r.importe : 0,
        estado: String(r.estado ?? ""),
        observaciones: String(r.observaciones ?? ""),
      };
    });
  },
};
