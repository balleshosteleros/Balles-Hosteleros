import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listClientes } from "@/features/sala/actions/clientes-actions";
import type { Cliente } from "@/features/sala/data/clientes";

const CLASIFICACIONES = ["REGULAR", "VIP", "NUEVO"] as const;

const clienteSchema = z.object({
  id: z.string(),
  nombre: z.string().min(1),
  telefono: z.string(),
  email: z.string(),
  clasificacion: z.enum(CLASIFICACIONES),
  visitas: z.number(),
  ultimaVisita: z.string(),
  observaciones: z.string(),
  notasInternas: z.string(),
});

const schema = clienteSchema as unknown as RowSchema<Cliente>;

export const clientesIO: ModuleIO<Cliente> = {
  module: "sala",
  submodule: "clientes",
  label: "Clientes de sala",
  description: "Base de datos de clientes con notas y clasificación.",
  schema,
  uniqueBy: "telefono",
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "nombre", label: "Nombre", required: true, example: "María García" },
    { key: "telefono", label: "Teléfono", aliases: ["movil", "tlf"], required: true, unique: true, example: "612345678" },
    { key: "email", label: "Email" },
    { key: "clasificacion", label: "Clasificación", type: "enum", values: CLASIFICACIONES, example: "REGULAR" },
    { key: "visitas", label: "Visitas", type: "number" },
    { key: "ultimaVisita", label: "Última visita", type: "date" },
    { key: "observaciones", label: "Observaciones" },
    { key: "notasInternas", label: "Notas internas" },
  ],
  fetchAll: async () => {
    const result = await listClientes();
    if (!result.ok) return [];
    return (result.data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id ?? ""),
        nombre: (r.nombre as string) ?? "",
        telefono: (r.telefono as string) ?? "",
        email: (r.email as string) ?? "",
        clasificacion: ((r.clasificacion as Cliente["clasificacion"]) ?? "NUEVO"),
        visitas: (r.visitas as number) ?? 0,
        ultimaVisita: (r.ultima_visita as string) ?? "",
        observaciones: (r.observaciones as string) ?? "",
        notasInternas: (r.notas_internas as string) ?? "",
      } as Cliente;
    });
  },
};
