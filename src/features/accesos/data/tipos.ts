import { z } from "zod";

export const CATEGORIAS_APP = [
  "Banca y pagos",
  "Correo / Drive",
  "Gestión restaurante",
  "Redes y marketing",
  "Proveedores y compras",
  "Internet / Wifi / TV",
  "Seguridad y accesos",
  "Móviles / SIM",
  "Suministros / Admin",
  "Otros",
] as const;

export type CategoriaApp = (typeof CATEGORIAS_APP)[number];

export const appExternaSchema = z.object({
  id: z.string().guid().optional(),
  nombre: z.string().trim().min(1, "Nombre obligatorio").max(120),
  url: z
    .string()
    .trim()
    .url("URL inválida")
    .optional()
    .or(z.literal("")),
  logo_url: z.string().trim().optional().or(z.literal("")),
  categoria: z.enum(CATEGORIAS_APP),
  notas: z.string().trim().optional().default(""),
});

export type AppExternaInput = z.infer<typeof appExternaSchema>;

export type AppExterna = {
  id: string;
  empresa_id: string;
  nombre: string;
  url: string | null;
  logo_url: string | null;
  categoria: CategoriaApp;
  notas: string;
  created_at: string;
  updated_at: string;
};

/**
 * DATO EXTRA: campo flexible nombre/valor para accesos que no encajan en
 * "usuario + contraseña". Ej: PIN, PUK, Código empresa (3er dato NetCash),
 * Verificación, Códigos de respaldo. El valor SIEMPRE se cifra.
 */
export const datoExtraSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre del dato obligatorio").max(60),
  valor: z.string().min(1, "Valor obligatorio").max(500),
});
export type DatoExtraInput = z.infer<typeof datoExtraSchema>;

/** Dato extra tal como se lista (valor oculto hasta revelar). */
export type DatoExtraMeta = { nombre: string };

export const credencialSchema = z.object({
  id: z.string().guid().optional(),
  app_id: z.string().guid("App requerida"),
  etiqueta: z.string().trim().min(1, "Etiqueta obligatoria").max(120),
  usuario: z.string().trim().max(200).optional().default(""),
  password: z.string().max(500).optional().default(""),
  url_especifica: z.string().trim().url("URL inválida").optional().or(z.literal("")),
  notas: z.string().trim().optional().default(""),
  /** ROL RESPONSABLE — informativo, nombre de rol o vacío. */
  rol_responsable: z.string().trim().max(120).optional().default(""),
  datos_extra: z.array(datoExtraSchema).max(20).optional().default([]),
  /** ROL VISIBLE — manda la seguridad. Multi-rol, al menos uno. */
  roles_ids: z
    .array(z.string().guid())
    .min(1, "Selecciona al menos un rol que pueda verla"),
});

export type CredencialInput = z.infer<typeof credencialSchema>;

export const credencialUpdateSchema = credencialSchema;
export type CredencialUpdateInput = z.infer<typeof credencialUpdateSchema>;

export type Credencial = {
  id: string;
  app_id: string;
  empresa_id: string;
  etiqueta: string;
  usuario: string;
  url_especifica: string | null;
  notas: string;
  rol_responsable: string;
  /** Metadatos de los datos extra (solo nombres; valores se revelan aparte). */
  datos_extra: DatoExtraMeta[];
  created_at: string;
  updated_at: string;
  /** ROL VISIBLE asignados. */
  roles: Array<{ id: string; nombre: string }>;
};

export type RolOption = { id: string; nombre: string };
