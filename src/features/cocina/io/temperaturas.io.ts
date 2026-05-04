import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listEquipos } from "@/features/cocina/actions/temperaturas-actions";
import type { EquipoFrio } from "@/features/cocina/data/temperaturas";

const TIPOS = ["NEVERA", "CONGELADOR", "CÁMARA", "BOTELLERO", "OTRO"] as const;
const ESTADOS = ["ACTIVO", "INACTIVO", "EN REPARACIÓN"] as const;
const AREAS = ["SALA", "COCINA"] as const;

const equipoSchema = z.object({
  id: z.string(),
  nombre: z.string().min(1),
  tipo: z.enum(TIPOS),
  area: z.enum(AREAS),
  ubicacion: z.string(),
  rangoMin: z.number(),
  rangoMax: z.number(),
  estado: z.enum(ESTADOS),
  observaciones: z.string(),
});

const schema = equipoSchema as unknown as RowSchema<EquipoFrio>;

export const temperaturasEquiposIO: ModuleIO<EquipoFrio> = {
  module: "cocina",
  submodule: "temperaturas-equipos",
  label: "Equipos de frío",
  description: "Catálogo de neveras, congeladores y cámaras con sus rangos de temperatura.",
  schema,
  uniqueBy: "nombre",
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "nombre", label: "Nombre", required: true, unique: true, example: "Nevera barra 1" },
    { key: "tipo", label: "Tipo", type: "enum", values: TIPOS, required: true },
    { key: "area", label: "Área", type: "enum", values: AREAS, required: true },
    { key: "ubicacion", label: "Ubicación" },
    { key: "rangoMin", label: "Rango mín. (°C)", type: "number", example: "1" },
    { key: "rangoMax", label: "Rango máx. (°C)", type: "number", example: "5" },
    { key: "estado", label: "Estado", type: "enum", values: ESTADOS },
    { key: "observaciones", label: "Observaciones" },
  ],
  fetchAll: async () => {
    const result = await listEquipos();
    if (!result.ok) return [];
    return (result.data ?? []) as EquipoFrio[];
  },
};
