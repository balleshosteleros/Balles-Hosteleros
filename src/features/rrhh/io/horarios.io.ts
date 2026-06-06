import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { formatTurnoHorario, calcularDuracionTurno, type Turno } from "@/features/rrhh/data/horarios";
import { listTurnos } from "@/features/rrhh/actions/turnos-actions";

const turnoSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  codigo: z.string(),
  horario: z.string(),
  duracion: z.number(),
  color: z.string(),
});

type TurnoExportRow = z.infer<typeof turnoSchema>;
const schema = turnoSchema as unknown as RowSchema<TurnoExportRow>;

export const horariosIO: ModuleIO<TurnoExportRow> = {
  module: "rrhh",
  submodule: "horarios",
  label: "Turnos / Horarios",
  description: "Configuración de turnos laborales.",
  schema,
  uniqueBy: "nombre",
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "codigo", label: "Código", aliases: ["code"], required: true, unique: true, example: "MAN" },
    { key: "nombre", label: "Nombre", required: true, example: "COCINERO SABADO" },
    { key: "horario", label: "Horario", example: "12:30 - 17:00 / 19:30 - 00:30" },
    { key: "duracion", label: "Duración (h)", type: "number", example: "8" },
    { key: "color", label: "Color" },
  ],
  fetchAll: async (ctx) => {
    const res = await listTurnos((ctx.empresaId as string) ?? "");
    const turnos: Turno[] = res.ok ? res.data : [];
    return turnos.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      codigo: t.codigo,
      horario: formatTurnoHorario(t),
      duracion: calcularDuracionTurno(t),
      color: t.color,
    }));
  },
};
