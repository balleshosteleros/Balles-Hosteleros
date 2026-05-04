import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { buildSamplePublicaciones, type ItemCalendario } from "@/features/marketing/data/marketing";

const itemSchema = z.object({
  id: z.string(),
  tipo: z.string(),
  titulo: z.string().optional(),
  fecha: z.string(),
  hora: z.string().optional(),
  empresaId: z.string(),
}).passthrough();

const schema = itemSchema as unknown as RowSchema<ItemCalendario>;

export const calendarioMarketingIO: ModuleIO<ItemCalendario> = {
  module: "marketing",
  submodule: "calendario",
  label: "Calendario editorial",
  description: "Publicaciones y eventos planificados.",
  schema,
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "tipo", label: "Tipo", required: true },
    { key: "titulo", label: "Título" },
    { key: "fecha", label: "Fecha", type: "date", required: true },
    { key: "hora", label: "Hora" },
    { key: "empresaId", label: "Empresa", hideInImport: true },
  ],
  fetchAll: async (ctx) => buildSamplePublicaciones((ctx.empresaId as string) ?? ""),
};
