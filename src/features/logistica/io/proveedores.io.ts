import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import {
  listProveedores,
  bulkImportProveedores,
} from "@/features/logistica/actions/proveedores-actions";
import { ESTADOS_PROVEEDOR } from "@/features/logistica/data/proveedores";
import type { ProveedorImport } from "@/features/logistica/types/import";

const proveedorIOSchema = z.object({
  nombreComercial: z.string().min(1, "El nombre comercial es obligatorio"),
  razonSocial: z.string().nullable().optional(),
  cifNif: z.string().nullable().optional(),
  categoria: z.string().min(1, "La categoría es obligatoria"),
  estado: z.enum(ESTADOS_PROVEEDOR).optional(),
  personaContacto: z.string().nullable().optional(),
  telefonoPrincipal: z.string().nullable().optional(),
  telefonoSecundario: z.string().nullable().optional(),
  emailPrincipal: z.string().nullable().optional(),
  emailPedidos: z.string().nullable().optional(),
  emailIncidencias: z.string().nullable().optional(),
  web: z.string().nullable().optional(),
  direccion: z.string().nullable().optional(),
  ciudad: z.string().nullable().optional(),
  provincia: z.string().nullable().optional(),
  pais: z.string().nullable().optional(),
  codigoPostal: z.string().nullable().optional(),
  diasReparto: z.array(z.string()).optional(),
  condicionesPago: z.string().nullable().optional(),
  plazoEntrega: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  comentariosInternos: z.string().nullable().optional(),
});

const schema = proveedorIOSchema as unknown as RowSchema<ProveedorImport>;

export const proveedoresIO: ModuleIO<ProveedorImport> = {
  module: "logistica",
  submodule: "proveedores",
  label: "Proveedores",
  description: "Catálogo de proveedores con datos de contacto y condiciones comerciales.",
  schema,
  uniqueBy: "nombreComercial",
  columns: [
    { key: "nombreComercial", label: "Nombre comercial", aliases: ["nombre", "comercial"], required: true, unique: true, example: "Pescados Marisol" },
    { key: "razonSocial", label: "Razón social", example: "Pescados Marisol S.L." },
    { key: "cifNif", label: "CIF/NIF", aliases: ["nif", "cif"], example: "B12345678" },
    { key: "categoria", label: "Categoría", required: true, example: "Pescados y mariscos" },
    { key: "estado", label: "Estado", type: "enum", values: ESTADOS_PROVEEDOR, example: "Activo" },
    { key: "personaContacto", label: "Persona de contacto", aliases: ["contacto"], example: "Juan García" },
    { key: "telefonoPrincipal", label: "Teléfono principal", aliases: ["telefono"], example: "912345678" },
    { key: "telefonoSecundario", label: "Teléfono secundario" },
    { key: "emailPrincipal", label: "Email principal", aliases: ["email"], example: "ventas@marisol.es" },
    { key: "emailPedidos", label: "Email pedidos" },
    { key: "emailIncidencias", label: "Email incidencias" },
    { key: "web", label: "Web", aliases: ["website", "url"] },
    { key: "direccion", label: "Dirección" },
    { key: "ciudad", label: "Ciudad" },
    { key: "provincia", label: "Provincia" },
    { key: "pais", label: "País", example: "España" },
    { key: "codigoPostal", label: "Código postal", aliases: ["cp"] },
    { key: "diasReparto", label: "Días de reparto", type: "array", aliases: ["dias"], example: "Lunes, Miércoles, Viernes" },
    { key: "condicionesPago", label: "Condiciones de pago", example: "30 días" },
    { key: "plazoEntrega", label: "Plazo entrega", example: "24h" },
    { key: "observaciones", label: "Observaciones", aliases: ["notas"] },
    { key: "comentariosInternos", label: "Comentarios internos", hideInExport: false },
  ],
  fetchAll: async () => {
    const result = await listProveedores();
    const rows = result.ok ? result.data : [];
    return rows.map<ProveedorImport>((r) => ({
      nombreComercial: r.nombre_comercial ?? "",
      razonSocial: r.razon_social ?? null,
      cifNif: r.cif_nif ?? null,
      categoria: r.categoria ?? "",
      estado: r.estado as ProveedorImport["estado"],
      personaContacto: r.persona_contacto ?? null,
      telefonoPrincipal: r.telefono_principal ?? null,
      telefonoSecundario: r.telefono_secundario ?? null,
      emailPrincipal: r.email_principal ?? null,
      emailPedidos: r.email_pedidos ?? null,
      emailIncidencias: r.email_incidencias ?? null,
      web: r.web ?? null,
      direccion: r.direccion ?? null,
      ciudad: r.ciudad ?? null,
      provincia: r.provincia ?? null,
      pais: r.pais ?? null,
      codigoPostal: r.codigo_postal ?? null,
      diasReparto: r.dias_reparto ?? [],
      condicionesPago: r.condiciones_pago ?? null,
      plazoEntrega: r.plazo_entrega ?? null,
      observaciones: r.observaciones ?? null,
      comentariosInternos: r.comentarios_internos ?? null,
    }));
  },
  upsert: async (rows) => {
    const result = await bulkImportProveedores(rows);
    if (!result.ok) {
      return {
        ok: false,
        imported: 0,
        updated: 0,
        skipped: rows.length,
        errors: [{ row: 0, message: result.error ?? "Error al importar" }],
      };
    }
    return {
      ok: true,
      imported: result.imported ?? rows.length,
      updated: 0,
      skipped: rows.length - (result.imported ?? rows.length),
      errors: [],
    };
  },
};
