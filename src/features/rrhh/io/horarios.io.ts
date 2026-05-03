import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { getTurnosConfigPorEmpresa, type Turno } from "@/features/rrhh/data/horarios";

const turnoSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  codigo: z.string(),
  horaInicio: z.string(),
  horaFin: z.string(),
  duracion: z.number(),
  color: z.string(),
  descripcion: z.string(),
});

const schema = turnoSchema as unknown as RowSchema<Turno>;

export const horariosIO: ModuleIO<Turno> = {
  module: "rrhh",
  submodule: "horarios",
  label: "Turnos / Horarios",
  description: "Configuración de turnos laborales.",
  schema,
  uniqueBy: "nombre",
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "codigo", label: "Código", aliases: ["code"], required: true, unique: true, example: "M" },
    { key: "nombre", label: "Nombre", required: true, example: "Mañana" },
    { key: "horaInicio", label: "Hora inicio", example: "09:00" },
    { key: "horaFin", label: "Hora fin", example: "17:00" },
    { key: "duracion", label: "Duración (h)", type: "number", example: "8" },
    { key: "color", label: "Color" },
    { key: "descripcion", label: "Descripción" },
  ],
  fetchAll: async (ctx) => getTurnosConfigPorEmpresa((ctx.empresaId as string) ?? ""),
};
