import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { getFichajesPorEmpresa, type Fichaje } from "@/features/rrhh/data/fichajes";

const ESTADOS = ["pendiente", "trabajando", "pausa", "completado"] as const;

const fichajeSchema = z.object({
  id: z.string(),
  empleadoId: z.string(),
  empleadoNombre: z.string(),
  fecha: z.string(),
  horaEntrada: z.string().nullable(),
  horaSalida: z.string().nullable(),
  pausaInicio: z.string().nullable(),
  pausaFin: z.string().nullable(),
  horasTotales: z.number(),
  estado: z.enum(ESTADOS),
  incidencia: z.string().nullable(),
  validadoPor: z.string().nullable(),
});

const schema = fichajeSchema as unknown as RowSchema<Fichaje>;

export const fichajesIO: ModuleIO<Fichaje> = {
  module: "rrhh",
  submodule: "fichajes",
  label: "Fichajes",
  description: "Registro de entradas y salidas de empleados.",
  schema,
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "empleadoNombre", label: "Empleado", required: true },
    { key: "fecha", label: "Fecha", type: "date", required: true },
    { key: "horaEntrada", label: "Entrada", example: "09:00" },
    { key: "horaSalida", label: "Salida", example: "17:00" },
    { key: "pausaInicio", label: "Descanso inicio" },
    { key: "pausaFin", label: "Descanso fin" },
    { key: "horasTotales", label: "Horas totales", type: "number" },
    { key: "estado", label: "Estado", type: "enum", values: ESTADOS },
    { key: "incidencia", label: "Incidencia" },
    { key: "validadoPor", label: "Validado por" },
    { key: "empleadoId", label: "ID Empleado", hideInImport: true },
  ],
  fetchAll: async (ctx) => getFichajesPorEmpresa((ctx.empresaId as string) ?? ""),
};
