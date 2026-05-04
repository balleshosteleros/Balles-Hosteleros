import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listarMisFichajes } from "@/features/mi-panel/actions/mi-panel-actions";

interface FichajeExport {
  id: string;
  fecha: string;
  horaEntrada: string | null;
  horaSalida: string | null;
  horasTotales: number;
  estado: string;
  incidencia: string | null;
}

const fichajeSchema = z.object({
  id: z.string(),
  fecha: z.string(),
  horaEntrada: z.string().nullable(),
  horaSalida: z.string().nullable(),
  horasTotales: z.number(),
  estado: z.string(),
  incidencia: z.string().nullable(),
});

const schema = fichajeSchema as unknown as RowSchema<FichajeExport>;

export const misFichajesIO: ModuleIO<FichajeExport> = {
  module: "mi-panel",
  submodule: "mis-fichajes",
  label: "Mis fichajes",
  description: "Histórico personal de fichajes.",
  schema,
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "fecha", label: "Fecha", type: "date" },
    { key: "horaEntrada", label: "Entrada" },
    { key: "horaSalida", label: "Salida" },
    { key: "horasTotales", label: "Horas totales", type: "number" },
    { key: "estado", label: "Estado" },
    { key: "incidencia", label: "Incidencia" },
  ],
  fetchAll: async () => {
    const result = await listarMisFichajes();
    const ok = (result as { ok?: boolean }).ok;
    const data = (result as { data?: unknown }).data;
    if (!ok || !Array.isArray(data)) return [];
    return data.map<FichajeExport>((f) => {
      const r = f as Record<string, unknown>;
      return {
        id: String(r.id ?? ""),
        fecha: String(r.fecha ?? ""),
        horaEntrada: (r.horaEntrada as string | null) ?? (r.hora_entrada as string | null) ?? null,
        horaSalida: (r.horaSalida as string | null) ?? (r.hora_salida as string | null) ?? null,
        horasTotales: typeof r.horasTotales === "number" ? r.horasTotales : (typeof r.horas_totales === "number" ? r.horas_totales : 0),
        estado: String(r.estado ?? ""),
        incidencia: (r.incidencia as string | null) ?? null,
      };
    });
  },
};
