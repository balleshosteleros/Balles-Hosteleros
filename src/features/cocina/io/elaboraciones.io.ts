import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listElaboraciones } from "@/features/cocina/actions/elaboraciones-actions";

interface ElaboracionExport {
  id: string;
  nombre: string;
  categoria: string | null;
  descripcion: string | null;
  tiempo: string | null;
  responsable: string | null;
}

const elaboracionSchema = z.object({
  id: z.string(),
  nombre: z.string().min(1),
  categoria: z.string().nullable(),
  descripcion: z.string().nullable(),
  tiempo: z.string().nullable(),
  responsable: z.string().nullable(),
});

const schema = elaboracionSchema as unknown as RowSchema<ElaboracionExport>;

export const elaboracionesIO: ModuleIO<ElaboracionExport> = {
  module: "cocina",
  submodule: "elaboraciones",
  label: "Elaboraciones",
  description: "Procedimientos de elaboración con tiempo y responsable.",
  schema,
  uniqueBy: "nombre",
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "nombre", label: "Nombre", required: true, unique: true },
    { key: "categoria", label: "Categoría" },
    { key: "tiempo", label: "Tiempo" },
    { key: "responsable", label: "Responsable" },
    { key: "descripcion", label: "Descripción" },
  ],
  fetchAll: async () => {
    const result = await listElaboraciones();
    const rows = (result.ok ? result.data : []) as Array<Record<string, unknown>>;
    return rows.map<ElaboracionExport>((r) => ({
      id: String(r.id ?? ""),
      nombre: String(r.nombre ?? ""),
      categoria: (r.categoria as string | null) ?? null,
      descripcion: (r.descripcion as string | null) ?? null,
      tiempo: (r.tiempo as string | null) ?? null,
      responsable: (r.responsable as string | null) ?? null,
    }));
  },
};
