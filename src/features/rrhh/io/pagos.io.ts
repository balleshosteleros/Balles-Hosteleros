import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import type { PagoEmpleado } from "@/features/rrhh/data/pagos";

const pagoSchema = z.object({
  id: z.string(),
  empleadoId: z.string(),
  empleadoNombre: z.string(),
  fijo: z.boolean(),
  pago: z.number(),
  nomina: z.number(),
  horasReales: z.number(),
  horasTrabajadas: z.number(),
  propina: z.number(),
  ajuste: z.number(),
  horasExtras: z.number(),
  bonus: z.number(),
  propinaMantenimiento: z.number(),
  total: z.number(),
  pagado: z.boolean(),
});

const schema = pagoSchema as unknown as RowSchema<PagoEmpleado>;

export const pagosIO: ModuleIO<PagoEmpleado> = {
  module: "rrhh",
  submodule: "pagos",
  label: "Pagos / Nóminas",
  description: "Resumen de pagos a empleados (fijo, propinas, bonus, extras).",
  schema,
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "empleadoNombre", label: "Empleado", required: true },
    { key: "fijo", label: "Fijo", type: "boolean" },
    { key: "pago", label: "Pago base", type: "number" },
    { key: "nomina", label: "Nómina", type: "number" },
    { key: "horasReales", label: "Horas reales", type: "number" },
    { key: "horasTrabajadas", label: "Horas trabajadas", type: "number" },
    { key: "propina", label: "Propina", type: "number" },
    { key: "ajuste", label: "Ajuste", type: "number" },
    { key: "horasExtras", label: "Horas extras", type: "number" },
    { key: "bonus", label: "Bonus", type: "number" },
    { key: "propinaMantenimiento", label: "Propina mantenimiento", type: "number" },
    { key: "total", label: "Total", type: "number" },
    { key: "pagado", label: "Pagado", type: "boolean" },
    { key: "empleadoId", label: "ID Empleado", hideInImport: true },
  ],
  fetchAll: async () => {
    return [];
  },
};
