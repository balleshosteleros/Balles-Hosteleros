import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import { type AccesoApp } from "@/features/rrhh/data/accesos-apps";
import { listAccesosApps } from "@/features/rrhh/actions/accesos-apps-actions";

const ESTADOS = ["Activo", "Inactivo", "Archivado"] as const;
const TIPOS_INTEGRACION = ["enlace", "embebido", "sso", "oauth"] as const;

const accesoSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  descripcion: z.string(),
  url: z.string(),
  icono: z.string(),
  logoUrl: z.string().optional(),
  categoria: z.string(),
  departamentos: z.array(z.string()),
  rolesAutorizados: z.array(z.string()),
  usuario: z.string(),
  contrasena: z.string(),
  estado: z.enum(ESTADOS),
  responsable: z.string(),
  notas: z.string(),
  tipoIntegracion: z.enum(TIPOS_INTEGRACION),
  empresaId: z.string(),
  ultimaActualizacion: z.string(),
});

const schema = accesoSchema as unknown as RowSchema<AccesoApp>;

export const accesosIO: ModuleIO<AccesoApp> = {
  module: "rrhh",
  submodule: "accesos",
  label: "Accesos a apps",
  description: "Catálogo de aplicaciones externas con credenciales y permisos.",
  schema,
  uniqueBy: "nombre",
  columns: [
    { key: "id", label: "ID", hideInImport: true },
    { key: "nombre", label: "Nombre", required: true, unique: true, example: "Holded" },
    { key: "categoria", label: "Categoría", required: true },
    { key: "url", label: "URL" },
    { key: "tipoIntegracion", label: "Integración", type: "enum", values: TIPOS_INTEGRACION },
    { key: "estado", label: "Estado", type: "enum", values: ESTADOS },
    { key: "responsable", label: "Responsable" },
    { key: "departamentos", label: "Departamentos", type: "array" },
    { key: "rolesAutorizados", label: "Roles autorizados", type: "array" },
    { key: "usuario", label: "Usuario", hideInExport: true, hideInImport: true },
    { key: "contrasena", label: "Contraseña", hideInExport: true, hideInImport: true },
    { key: "icono", label: "Icono" },
    { key: "logoUrl", label: "Logo URL" },
    { key: "descripcion", label: "Descripción" },
    { key: "notas", label: "Notas" },
    { key: "ultimaActualizacion", label: "Actualizado", hideInImport: true },
    { key: "empresaId", label: "Empresa", hideInImport: true },
  ],
  fetchAll: async (ctx) => listAccesosApps((ctx.empresaId as string) ?? ""),
};
