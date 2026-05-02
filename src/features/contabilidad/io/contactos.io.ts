import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listContactos } from "@/features/contabilidad/actions/contabilidad-actions";
import type { ContactoContable } from "@/features/contabilidad/data/contabilidad";

const contactoSchema = z.object({
  id: z.string(),
  nombre: z.string().min(1),
  tipo: z.enum(["EMPRESA", "AUTONOMO", "PARTICULAR"]),
  documento: z.string(),
  email: z.string(),
  etiquetas: z.array(z.string()),
  categoria: z.string(),
  observaciones: z.string(),
});

const schema = contactoSchema as unknown as RowSchema<ContactoContable>;

export const contactosContablesIO: ModuleIO<ContactoContable> = {
  module: "contabilidad",
  submodule: "contactos",
  label: "Contactos contables",
  description: "Clientes y proveedores para facturación.",
  schema,
  uniqueBy: "documento",
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "nombre", label: "Nombre", required: true, example: "Distribuidora Central S.A." },
    { key: "tipo", label: "Tipo", type: "enum", values: ["EMPRESA", "AUTONOMO", "PARTICULAR"], required: true },
    { key: "documento", label: "CIF/NIF", aliases: ["nif", "cif"], required: true, unique: true, example: "B12345678" },
    { key: "email", label: "Email", example: "facturacion@empresa.com" },
    { key: "categoria", label: "Categoría" },
    { key: "etiquetas", label: "Etiquetas", type: "array", example: "Proveedor, Pescados" },
    { key: "observaciones", label: "Observaciones" },
  ],
  fetchAll: async () => {
    const result = await listContactos();
    if (!result.ok) return [];
    return (result.data ?? []) as ContactoContable[];
  },
};
