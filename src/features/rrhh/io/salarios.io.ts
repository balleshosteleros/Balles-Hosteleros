import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { type PuestoSalarial } from "@/features/rrhh/data/salarios";
import { listSalariosEmpresa } from "@/features/rrhh/actions/salarios-actions";

const salarioSchema = z.object({
  id: z.string(),
  departamento: z.string(),
  puesto: z.string(),
  vacaciones: z.string(),
  nominaNeta: z.number(),
  efectivoExtra: z.number(),
  salarioNeto: z.number(),
  jornadaContrato: z.string(),
  horasSemanales: z.number(),
  diasLibres: z.number(),
  horarioSemanal: z.array(z.unknown()),
  observaciones: z.string(),
  objetivos: z.array(z.string()),
  estado: z.enum(["activo", "borrador", "inactivo"]),
  updatedAt: z.string(),
});

const schema = salarioSchema as unknown as RowSchema<PuestoSalarial>;

export const salariosIO: ModuleIO<PuestoSalarial> = {
  module: "rrhh",
  submodule: "salarios",
  label: "Salarios",
  description: "Tabla salarial por puesto y departamento.",
  schema,
  uniqueBy: "puesto",
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "departamento", label: "Departamento", required: true },
    { key: "puesto", label: "Puesto", required: true, unique: true },
    { key: "estado", label: "Estado", type: "enum", values: ["activo", "borrador", "inactivo"] },
    { key: "nominaNeta", label: "Nómina neta", type: "number" },
    { key: "efectivoExtra", label: "Efectivo extra", type: "number" },
    { key: "salarioNeto", label: "Salario neto", type: "number" },
    { key: "jornadaContrato", label: "Jornada" },
    { key: "horasSemanales", label: "Horas semanales", type: "number" },
    { key: "diasLibres", label: "Días libres", type: "number" },
    { key: "vacaciones", label: "Vacaciones" },
    { key: "objetivos", label: "Objetivos", type: "array" },
    { key: "observaciones", label: "Observaciones" },
    { key: "updatedAt", label: "Actualizado", hideInImport: true },
    { key: "horarioSemanal", label: "Horario semanal", hideInExport: true, hideInImport: true },
  ],
  fetchAll: async () => {
    return (await listSalariosEmpresa()).puestos;
  },
};
