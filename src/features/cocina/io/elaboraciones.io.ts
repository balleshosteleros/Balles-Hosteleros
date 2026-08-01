import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listElaboraciones } from "@/features/cocina/actions/elaboraciones-actions";

interface ElaboracionExport {
  id: string;
  nombre: string;
  cantidadProducida: number;
  unidad: string;
  fecha: string;
  fechaCaducidad: string;
  almacen: string;
  estado: string;
  responsable: string;
  descripcion: string;
}

const elaboracionSchema = z.object({
  id: z.string(),
  nombre: z.string().min(1),
  cantidadProducida: z.number(),
  unidad: z.string(),
  fecha: z.string(),
  fechaCaducidad: z.string(),
  almacen: z.string(),
  estado: z.string(),
  responsable: z.string(),
  descripcion: z.string(),
});

const schema = elaboracionSchema as unknown as RowSchema<ElaboracionExport>;

export const elaboracionesIO: ModuleIO<ElaboracionExport> = {
  module: "cocina",
  submodule: "elaboraciones",
  label: "Elaboraciones",
  description: "Registros de producción de elaboraciones.",
  schema,
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "nombre", label: "Elaboración", required: true },
    { key: "cantidadProducida", label: "Cantidad producida", type: "number" },
    { key: "unidad", label: "Unidad" },
    { key: "fecha", label: "Fecha producción", type: "date" },
    { key: "fechaCaducidad", label: "Caducidad", type: "date" },
    { key: "almacen", label: "Almacén" },
    { key: "estado", label: "Estado" },
    { key: "responsable", label: "Responsable" },
    { key: "descripcion", label: "Descripción" },
  ],
  fetchAll: async () => {
    const result = await listElaboraciones();
    const rows = (result.ok ? result.data : []) as Array<Record<string, unknown>>;
    return rows.map<ElaboracionExport>((r) => ({
      id: String(r.id ?? ""),
      nombre: String(r.nombre ?? ""),
      cantidadProducida: typeof r.cantidad_producida === "number" ? r.cantidad_producida : 0,
      unidad: String(r.unidad ?? ""),
      fecha: typeof r.fecha === "string" ? r.fecha.slice(0, 10) : "",
      fechaCaducidad: typeof r.fecha_caducidad === "string" ? r.fecha_caducidad.slice(0, 10) : "",
      almacen: String(r.almacen ?? ""),
      estado: String(r.estado ?? ""),
      responsable: String(r.responsable ?? ""),
      descripcion: String(r.descripcion ?? ""),
    }));
  },
};
