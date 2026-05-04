import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listPedidos } from "@/features/logistica/actions/pedidos-actions";

interface PedidoExport {
  numero: string;
  proveedor: string;
  fecha: string | null;
  estado: string;
  total: number | null;
  notas: string | null;
}

const pedidoSchema = z.object({
  numero: z.string(),
  proveedor: z.string(),
  fecha: z.string().nullable(),
  estado: z.string(),
  total: z.number().nullable(),
  notas: z.string().nullable(),
});

const schema = pedidoSchema as unknown as RowSchema<PedidoExport>;

export const pedidosIO: ModuleIO<PedidoExport> = {
  module: "logistica",
  submodule: "pedidos",
  label: "Pedidos",
  description: "Histórico de pedidos a proveedores.",
  schema,
  columns: [
    { key: "numero", label: "Número", required: true, unique: true },
    { key: "proveedor", label: "Proveedor", required: true },
    { key: "fecha", label: "Fecha", type: "date" },
    { key: "estado", label: "Estado" },
    { key: "total", label: "Total", type: "number" },
    { key: "notas", label: "Notas" },
  ],
  fetchAll: async () => {
    const result = await listPedidos();
    const rows = (result.ok ? result.data : []) as Array<Record<string, unknown>>;
    return rows.map<PedidoExport>((r) => ({
      numero: String(r.numero ?? ""),
      proveedor: String(r.proveedor_nombre ?? r.proveedor ?? ""),
      fecha: (r.fecha as string | null) ?? null,
      estado: String(r.estado ?? ""),
      total: typeof r.total === "number" ? r.total : null,
      notas: (r.notas as string | null) ?? null,
    }));
  },
};
