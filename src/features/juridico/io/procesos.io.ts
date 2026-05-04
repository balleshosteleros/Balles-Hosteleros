import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listProcesos } from "@/features/juridico/actions/procesos-actions";
import type { ProcesoJuridico } from "@/features/juridico/data/procesos-juridicos";

const procesoSchema = z.object({
  id: z.string(),
  titulo: z.string().min(1),
  empresa: z.string(),
  empresaId: z.string(),
  tipo: z.string(),
  juridico: z.string(),
  fecha: z.string(),
  estado: z.string(),
  gravedad: z.string(),
  descripcion: z.string(),
  documentos: z.array(z.unknown()),
  actualizaciones: z.array(z.unknown()),
});

const schema = procesoSchema as unknown as RowSchema<ProcesoJuridico>;

export const procesosJuridicosIO: ModuleIO<ProcesoJuridico> = {
  module: "juridico",
  submodule: "procesos",
  label: "Procesos jurídicos",
  description: "Procesos legales y litigios en curso.",
  schema,
  uniqueBy: "titulo",
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "titulo", label: "Título", required: true, unique: true },
    { key: "tipo", label: "Tipo" },
    { key: "estado", label: "Estado" },
    { key: "gravedad", label: "Gravedad" },
    { key: "fecha", label: "Fecha", type: "date" },
    { key: "empresa", label: "Empresa" },
    { key: "juridico", label: "Asesor jurídico" },
    { key: "descripcion", label: "Descripción" },
    { key: "documentos", label: "Documentos", hideInExport: true, hideInImport: true },
    { key: "actualizaciones", label: "Actualizaciones", hideInExport: true, hideInImport: true },
    { key: "empresaId", label: "Empresa ID", hideInImport: true },
  ],
  fetchAll: async () => {
    const result = await listProcesos();
    const ok = (result as { ok?: boolean }).ok;
    const data = (result as { data?: unknown }).data;
    if (!ok || !Array.isArray(data)) return [];
    return data as ProcesoJuridico[];
  },
};
