/**
 * Schemas para "Rellenar con IA" en Aperturas (PRP-038).
 *
 * Dos representaciones por bloque:
 *  - `GEMINI_SCHEMA_*`: Schema del SDK `@google/generative-ai` (responseSchema).
 *  - `Z_*`: Schema Zod usado en server para validar / normalizar lo que devuelve Gemini.
 *
 * Ambas se mantienen alineadas a mano (igual que en `contabilidad/actions/importador-ia-actions.ts`).
 * Cualquier campo nuevo se añade en los DOS sitios.
 *
 * Regla: todos los campos son nullable / opcionales. Si la IA no infiere, deja null.
 * Nada de "valores por defecto inventados" — eso es trabajo de la UI al aplicar el draft.
 */
import { SchemaType, type Schema } from "@google/generative-ai";
import { z } from "zod";
import {
  DIAS_SEMANA,
  FRANJAS_HORARIAS,
  ESCENARIOS_FIJOS,
} from "@/features/direccion/data/aperturas";

/* ────────────────────────────────────────────────────────────────────
 * DATOS
 * ──────────────────────────────────────────────────────────────────── */

export const GEMINI_SCHEMA_DATOS: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    nombre: { type: SchemaType.STRING, nullable: true, description: "Nombre del local / proyecto." },
    ciudad: { type: SchemaType.STRING, nullable: true },
    zona: { type: SchemaType.STRING, nullable: true, description: "Barrio o zona concreta." },
    poblacion: { type: SchemaType.NUMBER, nullable: true, description: "Habitantes de la ciudad." },
    afluencia: { type: SchemaType.STRING, nullable: true, description: "Descripción cualitativa de afluencia (alta/media/baja + matiz)." },
    tipoLocal: { type: SchemaType.STRING, nullable: true, description: "Ej: restaurante casual, gastrobar, brasería." },
    metrosCuadrados: { type: SchemaType.NUMBER, nullable: true },
    ventasEstimadas: { type: SchemaType.NUMBER, nullable: true, description: "Ventas mensuales estimadas en euros. Solo si hay base." },
    ticketMedio: { type: SchemaType.NUMBER, nullable: true, description: "Ticket medio en euros." },
    clientesEstimados: { type: SchemaType.NUMBER, nullable: true, description: "Clientes mensuales estimados." },
    estacionalidad: { type: SchemaType.STRING, nullable: true },
    competencia: { type: SchemaType.STRING, nullable: true, description: "Descripción de competencia cercana." },
    observaciones: { type: SchemaType.STRING, nullable: true },
  },
};

export const Z_DATOS = z
  .object({
    nombre: z.string().nullable().optional(),
    ciudad: z.string().nullable().optional(),
    zona: z.string().nullable().optional(),
    poblacion: z.number().nullable().optional(),
    afluencia: z.string().nullable().optional(),
    tipoLocal: z.string().nullable().optional(),
    metrosCuadrados: z.number().nullable().optional(),
    ventasEstimadas: z.number().nullable().optional(),
    ticketMedio: z.number().nullable().optional(),
    clientesEstimados: z.number().nullable().optional(),
    estacionalidad: z.string().nullable().optional(),
    competencia: z.string().nullable().optional(),
    observaciones: z.string().nullable().optional(),
  })
  .strip();

/* ────────────────────────────────────────────────────────────────────
 * LOCAL (características + ubicación; las fotos NO se infieren por IA)
 * ──────────────────────────────────────────────────────────────────── */

export const GEMINI_SCHEMA_LOCAL: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    caracteristicas: {
      type: SchemaType.OBJECT,
      nullable: true,
      properties: {
        tipoEstablecimiento: { type: SchemaType.STRING, nullable: true, description: "Ej: bajo comercial, esquina, planta calle." },
        metrosUtiles: { type: SchemaType.NUMBER, nullable: true },
        metrosTerraza: { type: SchemaType.NUMBER, nullable: true },
        plazasInterior: { type: SchemaType.NUMBER, nullable: true },
        plazasTerraza: { type: SchemaType.NUMBER, nullable: true },
        plantasLocal: { type: SchemaType.NUMBER, nullable: true },
        banos: { type: SchemaType.NUMBER, nullable: true },
        acceso: { type: SchemaType.STRING, nullable: true, description: "Accesibilidad, entradas." },
        estadoLocal: { type: SchemaType.STRING, nullable: true, description: "Ej: a reformar, llave en mano." },
        licenciaActividad: { type: SchemaType.STRING, nullable: true },
        salidaHumos: { type: SchemaType.STRING, nullable: true, description: "Ej: sí, hasta cubierta / no." },
        alquilerMensual: { type: SchemaType.NUMBER, nullable: true, description: "Euros/mes." },
        traspaso: { type: SchemaType.NUMBER, nullable: true, description: "Euros pagados como traspaso, 0 si no aplica." },
        duracionContrato: { type: SchemaType.STRING, nullable: true, description: "Ej: 10 años + 5." },
        observaciones: { type: SchemaType.STRING, nullable: true },
      },
    },
    ubicacion: {
      type: SchemaType.OBJECT,
      nullable: true,
      properties: {
        direccion: { type: SchemaType.STRING, nullable: true, description: "Calle + número." },
        ciudad: { type: SchemaType.STRING, nullable: true },
        codigoPostal: { type: SchemaType.STRING, nullable: true, description: "5 dígitos para España." },
        pais: { type: SchemaType.STRING, nullable: true, description: "Por defecto España si no se infiere." },
      },
    },
  },
};

export const Z_LOCAL = z
  .object({
    caracteristicas: z
      .object({
        tipoEstablecimiento: z.string().nullable().optional(),
        metrosUtiles: z.number().nullable().optional(),
        metrosTerraza: z.number().nullable().optional(),
        plazasInterior: z.number().nullable().optional(),
        plazasTerraza: z.number().nullable().optional(),
        plantasLocal: z.number().nullable().optional(),
        banos: z.number().nullable().optional(),
        acceso: z.string().nullable().optional(),
        estadoLocal: z.string().nullable().optional(),
        licenciaActividad: z.string().nullable().optional(),
        salidaHumos: z.string().nullable().optional(),
        alquilerMensual: z.number().nullable().optional(),
        traspaso: z.number().nullable().optional(),
        duracionContrato: z.string().nullable().optional(),
        observaciones: z.string().nullable().optional(),
      })
      .strip()
      .nullable()
      .optional(),
    ubicacion: z
      .object({
        direccion: z.string().nullable().optional(),
        ciudad: z.string().nullable().optional(),
        codigoPostal: z.string().nullable().optional(),
        pais: z.string().nullable().optional(),
      })
      .strip()
      .nullable()
      .optional(),
  })
  .strip();

/* ────────────────────────────────────────────────────────────────────
 * MARCA
 * ──────────────────────────────────────────────────────────────────── */

export const GEMINI_SCHEMA_MARCA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    claim: { type: SchemaType.STRING, nullable: true, description: "Tagline corto (max ~60 chars)." },
    descripcion: { type: SchemaType.STRING, nullable: true, description: "Descripción de marca (~2-4 frases)." },
    publicoObjetivo: { type: SchemaType.STRING, nullable: true },
    valores: {
      type: SchemaType.ARRAY,
      nullable: true,
      description: "3-6 valores de marca en una palabra cada uno.",
      items: { type: SchemaType.STRING },
    },
    tipografiaTitulares: { type: SchemaType.STRING, nullable: true, description: "Nombre tipografía sugerida." },
    tipografiaCuerpo: { type: SchemaType.STRING, nullable: true },
    paleta: {
      type: SchemaType.ARRAY,
      nullable: true,
      description: "3-6 colores con nombre + hex (#RRGGBB).",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          nombre: { type: SchemaType.STRING },
          hex: { type: SchemaType.STRING, description: "Color en hex con #." },
        },
        required: ["nombre", "hex"],
      },
    },
  },
};

const Z_HEX = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/i, "hex inválido");

export const Z_MARCA = z
  .object({
    claim: z.string().nullable().optional(),
    descripcion: z.string().nullable().optional(),
    publicoObjetivo: z.string().nullable().optional(),
    valores: z.array(z.string()).nullable().optional(),
    tipografiaTitulares: z.string().nullable().optional(),
    tipografiaCuerpo: z.string().nullable().optional(),
    paleta: z
      .array(z.object({ nombre: z.string(), hex: Z_HEX }).strip())
      .nullable()
      .optional(),
  })
  .strip();

/* ────────────────────────────────────────────────────────────────────
 * GASTRONOMÍA
 * ──────────────────────────────────────────────────────────────────── */

export const GEMINI_SCHEMA_GASTRONOMIA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    concepto: { type: SchemaType.STRING, nullable: true, description: "Ej: cocina mediterránea de mercado." },
    descripcion: { type: SchemaType.STRING, nullable: true },
    estiloServicio: { type: SchemaType.STRING, nullable: true, description: "Ej: a la carta + menú degustación." },
    rangoPrecioMedio: { type: SchemaType.STRING, nullable: true, description: "Ej: 30-45€." },
    numeroPlatosCarta: { type: SchemaType.NUMBER, nullable: true },
    cartaUrl: { type: SchemaType.STRING, nullable: true, description: "URL pública a la carta si existe; null si no." },
    platos: {
      type: SchemaType.ARRAY,
      nullable: true,
      description: "8-12 platos destacados.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          nombre: { type: SchemaType.STRING },
          descripcion: { type: SchemaType.STRING, nullable: true },
          precio: { type: SchemaType.NUMBER, nullable: true },
          categoria: { type: SchemaType.STRING, nullable: true, description: "Ej: entrante, principal, postre, cóctel." },
        },
        required: ["nombre"],
      },
    },
    categoriasVenta: {
      type: SchemaType.ARRAY,
      nullable: true,
      description: "Mix de venta por categoría. Suma debe rondar 100%.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          nombre: { type: SchemaType.STRING },
          porcentaje: { type: SchemaType.NUMBER, description: "0 a 100." },
        },
        required: ["nombre", "porcentaje"],
      },
    },
  },
};

export const Z_GASTRONOMIA = z
  .object({
    concepto: z.string().nullable().optional(),
    descripcion: z.string().nullable().optional(),
    estiloServicio: z.string().nullable().optional(),
    rangoPrecioMedio: z.string().nullable().optional(),
    numeroPlatosCarta: z.number().nullable().optional(),
    cartaUrl: z.string().nullable().optional(),
    platos: z
      .array(
        z
          .object({
            nombre: z.string().min(1),
            descripcion: z.string().nullable().optional(),
            precio: z.number().nullable().optional(),
            categoria: z.string().nullable().optional(),
          })
          .strip(),
      )
      .nullable()
      .optional(),
    categoriasVenta: z
      .array(
        z
          .object({
            nombre: z.string().min(1),
            porcentaje: z.number().min(0).max(100),
          })
          .strip(),
      )
      .nullable()
      .optional(),
  })
  .strip();

/* ────────────────────────────────────────────────────────────────────
 * OCUPACIÓN (3 escenarios fijos × 7 días × 3 franjas; 0..100)
 * ──────────────────────────────────────────────────────────────────── */

const DIAS_KEYS = DIAS_SEMANA.map((d) => d.key) as readonly string[];
const FRANJAS_KEYS = FRANJAS_HORARIAS.map((f) => f.key) as readonly string[];
const ESCENARIO_NOMBRES = ESCENARIOS_FIJOS.map((e) => e.nombre) as readonly string[];

/* Estructura: { escenarios: [{ nombre, matriz: { lunes: { desayuno, comida, cena }, ... } }] } */
const matrizDiaProps: Record<string, Schema> = Object.fromEntries(
  FRANJAS_KEYS.map((f) => [f, { type: SchemaType.NUMBER, description: "0 a 100" } as Schema]),
);

const matrizProps: Record<string, Schema> = Object.fromEntries(
  DIAS_KEYS.map((d) => [
    d,
    {
      type: SchemaType.OBJECT,
      properties: matrizDiaProps,
      required: [...FRANJAS_KEYS],
    } as Schema,
  ]),
);

export const GEMINI_SCHEMA_OCUPACION: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    escenarios: {
      type: SchemaType.ARRAY,
      description: `Tres escenarios fijos: ${ESCENARIO_NOMBRES.join(", ")}.`,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          nombre: {
            type: SchemaType.STRING,
            enum: [...ESCENARIO_NOMBRES],
            format: "enum",
          },
          matriz: {
            type: SchemaType.OBJECT,
            properties: matrizProps,
            required: [...DIAS_KEYS],
          },
        },
        required: ["nombre", "matriz"],
      },
    },
  },
  required: ["escenarios"],
};

const Z_FRANJA_VALUE = z.number().min(0).max(100);
const Z_MATRIZ_DIA = z.object(
  Object.fromEntries(FRANJAS_KEYS.map((f) => [f, Z_FRANJA_VALUE])) as Record<
    string,
    typeof Z_FRANJA_VALUE
  >,
);
const Z_MATRIZ = z.object(
  Object.fromEntries(DIAS_KEYS.map((d) => [d, Z_MATRIZ_DIA])) as Record<
    string,
    typeof Z_MATRIZ_DIA
  >,
);

export const Z_OCUPACION = z
  .object({
    escenarios: z
      .array(
        z
          .object({
            nombre: z.enum([
              ESCENARIO_NOMBRES[0] as string,
              ...(ESCENARIO_NOMBRES.slice(1) as string[]),
            ] as [string, ...string[]]),
            matriz: Z_MATRIZ,
          })
          .strip(),
      )
      .min(1),
  })
  .strip();

/* ────────────────────────────────────────────────────────────────────
 * MAESTRO (modo "Apertura completa")
 *
 * Objeto con cada bloque como propiedad OPCIONAL. La IA rellena los que
 * pueda. Bloques financieros sólo se incluyen si `incluirCifrasFinancieras = true`.
 * ──────────────────────────────────────────────────────────────────── */

export const GEMINI_SCHEMA_MAESTRO: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    datos: GEMINI_SCHEMA_DATOS,
    local: GEMINI_SCHEMA_LOCAL,
    marca: GEMINI_SCHEMA_MARCA,
    gastronomia: GEMINI_SCHEMA_GASTRONOMIA,
    ocupacion: GEMINI_SCHEMA_OCUPACION,
  },
};

export const Z_MAESTRO = z
  .object({
    datos: Z_DATOS.optional(),
    local: Z_LOCAL.optional(),
    marca: Z_MARCA.optional(),
    gastronomia: Z_GASTRONOMIA.optional(),
    ocupacion: Z_OCUPACION.optional(),
  })
  .strip();

/* ────────────────────────────────────────────────────────────────────
 * Index por bloque (para selección dinámica desde la server action)
 * ──────────────────────────────────────────────────────────────────── */

import type { BloqueIAKey } from "@/features/direccion/types/aperturas-ia";

export const GEMINI_SCHEMA_POR_BLOQUE: Record<BloqueIAKey, Schema> = {
  datos: GEMINI_SCHEMA_DATOS,
  local: GEMINI_SCHEMA_LOCAL,
  marca: GEMINI_SCHEMA_MARCA,
  gastronomia: GEMINI_SCHEMA_GASTRONOMIA,
  ocupacion: GEMINI_SCHEMA_OCUPACION,
};

export const Z_POR_BLOQUE: Record<BloqueIAKey, z.ZodTypeAny> = {
  datos: Z_DATOS,
  local: Z_LOCAL,
  marca: Z_MARCA,
  gastronomia: Z_GASTRONOMIA,
  ocupacion: Z_OCUPACION,
};
