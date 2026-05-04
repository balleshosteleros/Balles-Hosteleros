import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listReservas } from "@/features/sala/actions/reservas-actions";
import type { Reserva } from "@/features/sala/data/reservas";

const ESTADOS = ["CONFIRMADA", "PENDIENTE", "RECONFIRMADA", "LISTA_ESPERA", "WALK_IN", "LLEGADA", "NO SHOW", "COMPLETADA", "CANCELADA"] as const;
const TURNOS = ["COMIDA", "CENA", "DIA_COMPLETO"] as const;
const ZONAS = ["SALA", "BARRA", "TERRAZA_INTERIOR", "TERRAZA_EXTERIOR", "PRIVADO", ""] as const;

const reservaSchema = z.object({
  id: z.string(),
  cliente: z.string(),
  apellidos: z.string(),
  telefono: z.string(),
  email: z.string(),
  fecha: z.string(),
  hora: z.string(),
  turno: z.enum(TURNOS),
  comensales: z.number(),
  zona: z.enum(ZONAS),
  mesaId: z.string(),
  estado: z.enum(ESTADOS),
}).passthrough();

const schema = reservaSchema as unknown as RowSchema<Reserva>;

export const reservasIO: ModuleIO<Reserva> = {
  module: "sala",
  submodule: "reservas",
  label: "Reservas",
  description: "Reservas de mesas con cliente, fecha y zona.",
  schema,
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "cliente", label: "Cliente", required: true },
    { key: "apellidos", label: "Apellidos" },
    { key: "telefono", label: "Teléfono", required: true },
    { key: "email", label: "Email" },
    { key: "fecha", label: "Fecha", type: "date", required: true },
    { key: "hora", label: "Hora", required: true, example: "20:30" },
    { key: "turno", label: "Turno", type: "enum", values: TURNOS },
    { key: "comensales", label: "Comensales", type: "number" },
    { key: "zona", label: "Zona", type: "enum", values: ZONAS },
    { key: "mesaId", label: "Mesa" },
    { key: "estado", label: "Estado", type: "enum", values: ESTADOS },
  ],
  fetchAll: async () => {
    const result = await listReservas();
    if (!result.ok) return [];
    return (result.data ?? []) as Reserva[];
  },
};
