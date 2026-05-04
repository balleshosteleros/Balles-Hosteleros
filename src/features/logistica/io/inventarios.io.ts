import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listInventarios } from "@/features/logistica/actions/inventarios-actions";

interface InventarioExport {
  nombre: string;
  fecha: string | null;
  almacen: string;
  estado: string;
  motivo: string | null;
  usuario: string | null;
}

const inventarioSchema = z.object({
  nombre: z.string(),
  fecha: z.string().nullable(),
  almacen: z.string(),
  estado: z.string(),
  motivo: z.string().nullable(),
  usuario: z.string().nullable(),
});

const schema = inventarioSchema as unknown as RowSchema<InventarioExport>;

export const inventariosIO: ModuleIO<InventarioExport> = {
  module: "logistica",
  submodule: "inventarios",
  label: "Inventarios",
  description: "Recuentos de inventario realizados.",
  schema,
  columns: [
    { key: "nombre", label: "Nombre", required: true },
    { key: "fecha", label: "Fecha", type: "date" },
    { key: "almacen", label: "Almacén", aliases: ["almacen"] },
    { key: "estado", label: "Estado" },
    { key: "motivo", label: "Motivo" },
    { key: "usuario", label: "Usuario" },
  ],
  fetchAll: async () => {
    const result = await listInventarios();
    const rows = (result.ok ? result.data : []) as Array<Record<string, unknown>>;
    return rows.map<InventarioExport>((r) => ({
      nombre: String(r.nombre ?? ""),
      fecha: (r.fecha as string | null) ?? null,
      almacen: String(r.almacen ?? ""),
      estado: String(r.estado ?? ""),
      motivo: (r.motivo as string | null) ?? null,
      usuario: (r.usuario as string | null) ?? null,
    }));
  },
};
