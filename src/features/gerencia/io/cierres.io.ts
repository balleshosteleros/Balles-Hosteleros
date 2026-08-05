import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listCierres } from "@/features/gerencia/actions/cierres-actions";

const TIPO_LABEL: Record<string, string> = {
  cierre: "Cierre",
  retirada: "Retirada",
  ingreso: "Ingreso",
};

interface CierreExport {
  id: string;
  fecha: string;
  tipo: string;
  semana: string;
  efectivo_retirado: number;
  total_contado: number;
  estado: string;
  descuadre: number;
  gastos: number;
  observaciones: string;
}

const cierreSchema = z.object({
  id: z.string(),
  fecha: z.string(),
  tipo: z.string(),
  semana: z.string(),
  efectivo_retirado: z.number(),
  total_contado: z.number(),
  estado: z.string(),
  descuadre: z.number(),
  gastos: z.number(),
  observaciones: z.string(),
});

const schema = cierreSchema as unknown as RowSchema<CierreExport>;

export const cierresIO: ModuleIO<CierreExport> = {
  module: "gerencia",
  submodule: "cierres",
  label: "Cierres de caja",
  description: "Cierres diarios, semanales y mensuales.",
  schema,
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "fecha", label: "Fecha", type: "date", required: true },
    { key: "tipo", label: "Tipo" },
    { key: "semana", label: "Semana" },
    { key: "efectivo_retirado", label: "Efectivo retirado", type: "number" },
    { key: "total_contado", label: "Total cierre", type: "number" },
    { key: "estado", label: "Estado" },
    { key: "descuadre", label: "Descuadre", type: "number" },
    { key: "gastos", label: "Gastos", type: "number" },
    { key: "observaciones", label: "Observaciones" },
  ],
  fetchAll: async () => {
    const result = await listCierres();
    if (!result.ok) return [];
    return (result.data ?? []).map<CierreExport>((c) => ({
      id: c.id,
      fecha: c.fecha,
      tipo: TIPO_LABEL[c.tipo] ?? c.tipo,
      semana: c.semana_iso ?? "",
      // Se exporta con el signo real sobre la caja: el cierre suma, el ingreso resta,
      // y la retirada suma o resta según el sentido con el que se registró.
      efectivo_retirado: c.tipo === "cierre"
        ? Math.abs(c.efectivo_retirado)
        : c.tipo === "retirada" && c.retirada_entrada
          ? Math.abs(c.efectivo_retirado)
          : -Math.abs(c.efectivo_retirado),
      total_contado: c.total_contado,
      estado: c.cuadra ? "Cuadra" : c.descuadre >= 0 ? "Sobra" : "Falta",
      descuadre: c.descuadre,
      gastos: c.total_gastos,
      observaciones: c.notas ?? "",
    }));
  },
};
