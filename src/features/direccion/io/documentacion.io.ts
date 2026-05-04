import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listDocumentos } from "@/features/direccion/actions/documentacion-actions";

interface DocumentoExport {
  id: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  estado: string;
  nivelAcceso: string;
  fechaSubida: string;
  tamano: string;
}

const docSchema = z.object({
  id: z.string(),
  nombre: z.string().min(1),
  categoria: z.string(),
  descripcion: z.string(),
  estado: z.string(),
  nivelAcceso: z.string(),
  fechaSubida: z.string(),
  tamano: z.string(),
});

const schema = docSchema as unknown as RowSchema<DocumentoExport>;

export const documentacionIO: ModuleIO<DocumentoExport> = {
  module: "direccion",
  submodule: "documentacion",
  label: "Documentos",
  description: "Catálogo de documentos estratégicos.",
  schema,
  uniqueBy: "nombre",
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "nombre", label: "Nombre", required: true, unique: true },
    { key: "categoria", label: "Categoría" },
    { key: "estado", label: "Estado" },
    { key: "nivelAcceso", label: "Nivel acceso" },
    { key: "tamano", label: "Tamaño" },
    { key: "fechaSubida", label: "Fecha subida", type: "date" },
    { key: "descripcion", label: "Descripción" },
  ],
  fetchAll: async () => {
    const result = await listDocumentos();
    const ok = (result as { ok?: boolean }).ok;
    const data = (result as { data?: unknown }).data;
    if (!ok || !Array.isArray(data)) return [];
    return data.map<DocumentoExport>((d) => {
      const r = d as Record<string, unknown>;
      return {
        id: String(r.id ?? ""),
        nombre: String(r.nombre ?? ""),
        categoria: String(r.categoria ?? ""),
        descripcion: String(r.descripcion ?? ""),
        estado: String(r.estado ?? ""),
        nivelAcceso: String(r.nivelAcceso ?? r.nivel_acceso ?? ""),
        fechaSubida: String(r.fechaSubida ?? r.fecha_subida ?? ""),
        tamano: String(r.tamano ?? ""),
      };
    });
  },
};
