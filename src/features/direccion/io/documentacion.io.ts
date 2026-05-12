import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listAllDocumentos } from "@/features/direccion/actions/documentacion-actions";

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
    const result = await listAllDocumentos();
    if (!result.ok || !Array.isArray(result.data)) return [];
    return result.data.map<DocumentoExport>((r) => ({
      id: r.id,
      nombre: r.nombre,
      categoria: "", // ya no es columna; mantener compat con schema export
      descripcion: r.descripcion ?? "",
      estado: r.estado,
      nivelAcceso: r.nivel_acceso,
      fechaSubida: (r.created_at ?? "").slice(0, 10),
      tamano: r.tamano_bytes != null ? `${(r.tamano_bytes / 1024).toFixed(0)} KB` : "",
    }));
  },
};
