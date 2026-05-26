/**
 * Zod schemas para validar bloques antes de persistir en paginas_web.bloques (JSONB).
 * Llamar siempre desde server actions antes de INSERT/UPDATE.
 */
import { z } from "zod";
import { BLOQUE_TIPOS, type BloqueTipo } from "../types";

const idString = z.string().min(1).max(128);

const bloqueBaseSchema = z.object({
  id: idString,
  orden: z.number().int().nonnegative(),
  visible: z.boolean(),
});

export const heroDatosSchema = z.object({
  titulo: z.string().min(1).max(200),
  subtitulo: z.string().max(400).optional(),
  cta: z
    .object({
      label: z.string().min(1).max(60),
      href: z.string().min(1).max(500),
    })
    .optional(),
  foto_url: z.string().url().max(1000).optional(),
  overlay: z.number().min(0).max(1).optional(),
});

export const galeriaDatosSchema = z.object({
  imagenes: z
    .array(
      z.object({
        url: z.string().url().max(1000),
        alt: z.string().max(200),
      }),
    )
    .max(60),
  layout: z.enum(["grid", "masonry", "carrusel"]),
});

export const menuDatosSchema = z.object({
  fuente: z.enum(["carta_items", "manual"]),
  categoria_ids: z.array(z.string().uuid()).max(40).optional(),
  items_manual: z
    .array(
      z.object({
        nombre: z.string().min(1).max(200),
        precio: z.number().nonnegative(),
        descripcion: z.string().max(400).optional(),
      }),
    )
    .max(200)
    .optional(),
});

export const reservasDatosSchema = z.object({
  modo: z.enum(["embed_cover", "formulario_propio", "enlace_externo"]),
  url: z.string().url().max(1000).optional(),
  campos: z.array(z.string().max(40)).max(20).optional(),
});

export const testimoniosDatosSchema = z.object({
  items: z
    .array(
      z.object({
        nombre: z.string().min(1).max(120),
        texto: z.string().min(1).max(800),
        estrellas: z.number().int().min(1).max(5).optional(),
        foto_url: z.string().url().max(1000).optional(),
      }),
    )
    .max(30),
});

export const ctaDatosSchema = z.object({
  titulo: z.string().min(1).max(160),
  texto: z.string().max(400).optional(),
  boton: z.object({
    label: z.string().min(1).max(60),
    href: z.string().min(1).max(500),
    variante: z.enum(["primary", "ghost"]),
  }),
});

export const formularioCampoSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z][a-z0-9_]*$/, "Identificador inválido (a-z, 0-9, _)"),
  label: z.string().min(1).max(120),
  tipo: z.enum(["text", "email", "tel", "textarea"]),
  required: z.boolean(),
});

export const formularioDatosSchema = z.object({
  titulo: z.string().min(1).max(160),
  campos: z.array(formularioCampoSchema).min(1).max(15),
  mensaje_exito: z.string().min(1).max(300),
});

export const mapaDatosSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  zoom: z.number().int().min(1).max(20),
  direccion_texto: z.string().min(1).max(300),
});

export const footerDatosSchema = z.object({
  columnas: z
    .array(
      z.object({
        titulo: z.string().min(1).max(80),
        items: z
          .array(
            z.object({
              label: z.string().min(1).max(80),
              href: z.string().min(1).max(500),
            }),
          )
          .max(20),
      }),
    )
    .max(6),
  redes: z
    .array(
      z.object({
        red: z.string().min(1).max(40),
        url: z.string().url().max(500),
      }),
    )
    .max(12)
    .optional(),
  texto_legal: z.string().max(600).optional(),
});

export const textoLibreDatosSchema = z.object({
  html_seguro: z.string().max(50_000),
});

export const videoDatosSchema = z.object({
  proveedor: z.enum(["youtube", "vimeo", "url_directa"]),
  url: z.string().url().max(1000),
  autoplay: z.boolean(),
  muted: z.boolean(),
});

export const bolsaInspectoresDatosSchema = z.object({
  titulo: z.string().min(1).max(200),
  descripcion: z.string().max(500).optional(),
  cta_label: z.string().min(1).max(80),
});

export const datosSchemaPorTipo = {
  hero: heroDatosSchema,
  galeria: galeriaDatosSchema,
  menu: menuDatosSchema,
  reservas: reservasDatosSchema,
  testimonios: testimoniosDatosSchema,
  cta: ctaDatosSchema,
  formulario: formularioDatosSchema,
  mapa: mapaDatosSchema,
  footer: footerDatosSchema,
  texto_libre: textoLibreDatosSchema,
  video: videoDatosSchema,
  bolsa_inspectores: bolsaInspectoresDatosSchema,
} as const;

export const bloqueSchema = z.discriminatedUnion("tipo", [
  bloqueBaseSchema.extend({ tipo: z.literal("hero"), datos: heroDatosSchema }),
  bloqueBaseSchema.extend({ tipo: z.literal("galeria"), datos: galeriaDatosSchema }),
  bloqueBaseSchema.extend({ tipo: z.literal("menu"), datos: menuDatosSchema }),
  bloqueBaseSchema.extend({ tipo: z.literal("reservas"), datos: reservasDatosSchema }),
  bloqueBaseSchema.extend({ tipo: z.literal("testimonios"), datos: testimoniosDatosSchema }),
  bloqueBaseSchema.extend({ tipo: z.literal("cta"), datos: ctaDatosSchema }),
  bloqueBaseSchema.extend({ tipo: z.literal("formulario"), datos: formularioDatosSchema }),
  bloqueBaseSchema.extend({ tipo: z.literal("mapa"), datos: mapaDatosSchema }),
  bloqueBaseSchema.extend({ tipo: z.literal("footer"), datos: footerDatosSchema }),
  bloqueBaseSchema.extend({ tipo: z.literal("texto_libre"), datos: textoLibreDatosSchema }),
  bloqueBaseSchema.extend({ tipo: z.literal("video"), datos: videoDatosSchema }),
  bloqueBaseSchema.extend({ tipo: z.literal("bolsa_inspectores"), datos: bolsaInspectoresDatosSchema }),
]);

export const bloquesArraySchema = z.array(bloqueSchema).max(80);

export const seoConfigSchema = z.object({
  title: z.string().max(160).optional(),
  description: z.string().max(320).optional(),
  og_image: z.string().url().max(1000).optional(),
  robots: z.string().max(80).optional(),
});

export const brandingSnapshotSchema = z.object({
  color_primario: z.string().max(32).optional(),
  color_secundario: z.string().max(32).optional(),
  color_fondo: z.string().max(32).optional(),
  tipografia: z.string().max(120).optional(),
  logo_url: z.string().url().max(1000).optional(),
});

export function validarBloque(tipo: BloqueTipo, datos: unknown) {
  const schema = datosSchemaPorTipo[tipo];
  return schema.safeParse(datos);
}

export function esTipoBloqueValido(tipo: string): tipo is BloqueTipo {
  return (BLOQUE_TIPOS as readonly string[]).includes(tipo);
}
