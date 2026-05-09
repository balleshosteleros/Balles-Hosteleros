import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listEscandallos } from "@/features/cocina/actions/escandallos-actions";
import type { Escandallo } from "@/features/cocina/data/escandallos";

const ESTADOS = ["activa", "borrador", "archivada"] as const;

const escandalloSchema = z.object({
  id: z.string(),
  nombre: z.string().min(1),
  categoriaId: z.string(),
  delicatessen: z.boolean(),
  estado: z.enum(ESTADOS),
  fechaCreacion: z.string(),
  fechaActualizacion: z.string(),
  responsable: z.string(),
  ingredientes: z.array(z.unknown()),
  partida: z.string(),
  elaboracion: z.string(),
  guarnicion: z.string(),
  decoracion: z.string(),
  menaje: z.string(),
  presentacionMesa: z.string(),
  alergenos: z.array(z.string()),
  recomendaciones: z.array(z.string()),
  pvp: z.number(),
  costeTotal: z.number(),
  desglose: z.array(z.unknown()),
  empresaId: z.string(),
});

const schema = escandalloSchema as unknown as RowSchema<Escandallo>;

export const escandallosIO: ModuleIO<Escandallo> = {
  module: "cocina",
  submodule: "escandallos",
  label: "Escandallos",
  description: "Catálogo de platos con ingredientes, alérgenos, costes y PVP.",
  schema,
  uniqueBy: "nombre",
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "nombre", label: "Nombre", required: true, unique: true, example: "Croquetas de jamón" },
    { key: "categoriaId", label: "Categoría" },
    { key: "estado", label: "Estado", type: "enum", values: ESTADOS },
    { key: "delicatessen", label: "Delicatessen", type: "boolean" },
    { key: "responsable", label: "Responsable" },
    { key: "partida", label: "Partida" },
    { key: "pvp", label: "PVP", type: "number", example: "8.50" },
    { key: "costeTotal", label: "Coste total", type: "number" },
    { key: "alergenos", label: "Alérgenos", type: "array", example: "Gluten, Lácteos" },
    { key: "recomendaciones", label: "Recomendaciones", type: "array" },
    { key: "elaboracion", label: "Elaboración" },
    { key: "guarnicion", label: "Guarnición" },
    { key: "decoracion", label: "Decoración" },
    { key: "menaje", label: "Menaje" },
    { key: "presentacionMesa", label: "Presentación en mesa" },
    { key: "fechaCreacion", label: "Fecha creación", type: "date", hideInImport: true },
    { key: "fechaActualizacion", label: "Última actualización", type: "date", hideInImport: true },
    { key: "ingredientes", label: "Ingredientes", hideInExport: true, hideInImport: true },
    { key: "desglose", label: "Desglose", hideInExport: true, hideInImport: true },
    { key: "empresaId", label: "Empresa", hideInExport: true, hideInImport: true },
  ],
  fetchAll: async () => {
    const result = await listEscandallos();
    if (!result.ok) return [];
    return (result.data ?? []) as Escandallo[];
  },
};
