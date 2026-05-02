import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listIncidencias } from "@/features/logistica/actions/incidencias-actions";

interface IncidenciaExport {
  producto: string;
  proveedor: string | null;
  precioActual: number | null;
  precioNuevo: number | null;
  variacionPct: number | null;
  fecha: string | null;
}

const incidenciaSchema = z.object({
  producto: z.string(),
  proveedor: z.string().nullable(),
  precioActual: z.number().nullable(),
  precioNuevo: z.number().nullable(),
  variacionPct: z.number().nullable(),
  fecha: z.string().nullable(),
});

const schema = incidenciaSchema as unknown as RowSchema<IncidenciaExport>;

export const incidenciasIO: ModuleIO<IncidenciaExport> = {
  module: "logistica",
  submodule: "incidencias",
  label: "Incidencias de precio",
  description: "Variaciones de precio detectadas entre pedidos y facturas.",
  schema,
  columns: [
    { key: "producto", label: "Producto", required: true },
    { key: "proveedor", label: "Proveedor" },
    { key: "precioActual", label: "Precio actual", type: "number" },
    { key: "precioNuevo", label: "Precio nuevo", type: "number" },
    { key: "variacionPct", label: "Variación %", type: "number" },
    { key: "fecha", label: "Fecha", type: "date" },
  ],
  fetchAll: async () => {
    const result = await listIncidencias();
    const rows = (result.ok ? result.data : []) as Array<Record<string, unknown>>;
    return rows.map<IncidenciaExport>((r) => ({
      producto: String(r.producto ?? ""),
      proveedor: (r.proveedor as string | null) ?? null,
      precioActual: typeof r.precio_actual === "number" ? r.precio_actual : null,
      precioNuevo: typeof r.precio_nuevo === "number" ? r.precio_nuevo : null,
      variacionPct: typeof r.variacion_pct === "number" ? r.variacion_pct : null,
      fecha: typeof r.created_at === "string" ? r.created_at.slice(0, 10) : null,
    }));
  },
};
