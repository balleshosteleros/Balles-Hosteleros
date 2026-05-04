import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listCampanasAction } from "@/features/marketing/actions/campanas-actions";

interface CampanaExport {
  id: string;
  nombre: string;
  canal: string;
  estado: string;
  segmento: string;
  fechaEnvio: string | null;
}

const campanaSchema = z.object({
  id: z.string(),
  nombre: z.string().min(1),
  canal: z.string(),
  estado: z.string(),
  segmento: z.string(),
  fechaEnvio: z.string().nullable(),
});

const schema = campanaSchema as unknown as RowSchema<CampanaExport>;

export const campanasIO: ModuleIO<CampanaExport> = {
  module: "marketing",
  submodule: "campanas",
  label: "Campañas",
  description: "Campañas de email, WhatsApp y Meta.",
  schema,
  uniqueBy: "nombre",
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "nombre", label: "Nombre", required: true, unique: true },
    { key: "canal", label: "Canal", type: "enum", values: ["email", "whatsapp", "meta"], required: true },
    { key: "estado", label: "Estado" },
    { key: "segmento", label: "Segmento" },
    { key: "fechaEnvio", label: "Fecha envío", type: "date" },
  ],
  fetchAll: async () => {
    const result = await listCampanasAction();
    const ok = (result as { ok?: boolean }).ok;
    const data = (result as { data?: unknown }).data;
    if (!ok || !Array.isArray(data)) return [];
    return data.map<CampanaExport>((c) => {
      const r = c as Record<string, unknown>;
      return {
        id: String(r.id ?? ""),
        nombre: String(r.nombre ?? ""),
        canal: String(r.canal ?? ""),
        estado: String(r.estado ?? ""),
        segmento: String(r.segmento ?? ""),
        fechaEnvio: (r.fechaEnvio as string | null) ?? null,
      };
    });
  },
};
