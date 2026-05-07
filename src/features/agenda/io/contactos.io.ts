import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { listContactos } from "@/features/agenda/actions/contactos-actions";
import type { Contacto } from "@/features/agenda/types";

const contactoSchema = z.object({
  id: z.string(),
  empresa_id: z.string().nullable(),
  nombre: z.string().min(1),
  empresa_contacto: z.string().nullable(),
  categoria: z.string(),
  etiqueta_id: z.string().nullable(),
  telefono: z.string().nullable(),
  email: z.string().nullable(),
  whatsapp: z.string().nullable(),
  direccion: z.string().nullable(),
  notas: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  created_by: z.string().nullable(),
});

const schema = contactoSchema as unknown as RowSchema<Contacto>;

export const agendaContactosIO: ModuleIO<Contacto> = {
  module: "agenda",
  submodule: "contactos",
  label: "Agenda de contactos",
  description: "Contactos clasificados (clientes, proveedores, técnicos, etc.).",
  schema,
  uniqueBy: "telefono",
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "nombre", label: "Nombre", required: true, example: "Juan García" },
    { key: "empresa_contacto", label: "Empresa", aliases: ["empresa contacto"] },
    { key: "categoria", label: "Categoría", required: true, example: "Cliente" },
    { key: "etiqueta_id", label: "Etiqueta", hideInImport: true },
    { key: "telefono", label: "Teléfono", aliases: ["tlf"], unique: true, example: "612345678" },
    { key: "email", label: "Email" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "direccion", label: "Dirección" },
    { key: "notas", label: "Notas" },
    { key: "created_at", label: "Creado", hideInImport: true },
    { key: "updated_at", label: "Actualizado", hideInImport: true },
    { key: "empresa_id", label: "Empresa ID", hideInImport: true },
    { key: "created_by", label: "Creador", hideInImport: true },
  ],
  fetchAll: async () => listContactos(),
};
