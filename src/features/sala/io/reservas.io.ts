import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listReservas } from "@/features/sala/actions/reservas-actions";
import type { Reserva } from "@/features/sala/data/reservas";
import { ESTADOS_RESERVA } from "@/features/sala/data/reservas";

const ESTADOS = ESTADOS_RESERVA;
const TURNOS = ["COMIDA", "CENA"] as const;
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
  estado: z.enum(ESTADOS as unknown as [string, ...string[]]),
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
    return (result.data ?? []).map((r) => {
      return {
        id: String(r.id ?? ""),
        cliente: (r.cliente_nombre as string) ?? "",
        apellidos: (r.cliente_apellidos as string) ?? "",
        telefono: (r.cliente_telefono as string) ?? "",
        email: (r.cliente_email as string) ?? "",
        fecha: (r.fecha as string) ?? "",
        hora: (r.hora as string) ?? "",
        turno: (r.turno as Reserva["turno"]) ?? "COMIDA",
        comensales: (r.personas as number) ?? 0,
        zona: (r.zona as Reserva["zona"]) ?? "",
        mesaId: (r.mesa as string) ?? "",
        estado: (r.estado as Reserva["estado"]) ?? "CONFIRMADA",
        observaciones: (r.notas as string) ?? "",
      } as Reserva;
    });
  },
};
