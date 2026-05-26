import { z } from "zod";

export const CATEGORIAS_APP = [
  "Delivery",
  "Banca",
  "Marketing",
  "Logística",
  "RRHH",
  "Contabilidad",
  "Gestión",
  "Comunicación",
  "Otros",
] as const;

export type CategoriaApp = (typeof CATEGORIAS_APP)[number];

export const appExternaSchema = z.object({
  id: z.string().uuid().optional(),
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

export const credencialSchema = z.object({
  id: z.string().uuid().optional(),
  app_id: z.string().uuid("App requerida"),
  etiqueta: z.string().trim().min(1, "Etiqueta obligatoria").max(120),
  usuario: z.string().trim().min(1, "Usuario obligatorio").max(200),
  password: z.string().min(1, "Contraseña obligatoria").max(500),
  url_especifica: z.string().trim().url("URL inválida").optional().or(z.literal("")),
  notas: z.string().trim().optional().default(""),
  roles_ids: z
    .array(z.string().uuid())
    .min(1, "Selecciona al menos un rol"),
});

export type CredencialInput = z.infer<typeof credencialSchema>;

export const credencialUpdateSchema = credencialSchema.extend({
  password: z.string().max(500).optional(),
});
export type CredencialUpdateInput = z.infer<typeof credencialUpdateSchema>;

export type Credencial = {
  id: string;
  app_id: string;
  empresa_id: string;
  etiqueta: string;
  usuario: string;
  url_especifica: string | null;
  notas: string;
  created_at: string;
  updated_at: string;
  roles: Array<{ id: string; nombre: string }>;
};

export type RolOption = { id: string; nombre: string };
