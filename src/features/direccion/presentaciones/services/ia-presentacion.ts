import { z } from "zod";
import { SchemaType, type Schema } from "@google/generative-ai";
import { geminiJSON } from "@/lib/ia/gemini";
import type { GenerarInput, Tono } from "../types/presentaciones";

/* ── Zod de la respuesta IA (validación en runtime) ── */

export const SlideSchemaZ = z.object({
  layout: z.enum(["portada", "bullets", "cita", "comparacion", "imagen", "cierre"]),
  titulo: z.string().min(1).max(120),
  bullets: z.array(z.string().max(200)).max(6).optional(),
  cuerpo: z.string().max(600).optional(),
  cita: z.string().max(300).optional(),
  comparacion: z
    .object({
      izquierda: z.array(z.string().max(200)).max(5),
      derecha: z.array(z.string().max(200)).max(5),
      tituloIzq: z.string().max(60).optional(),
      tituloDer: z.string().max(60).optional(),
    })
    .optional(),
  imagen_prompt: z.string().max(200).optional(),
  notas: z.string().max(500).optional(),
});

export const PresentacionGeneradaSchemaZ = z.object({
  titulo: z.string().min(1).max(150),
  slides: z.array(SlideSchemaZ).min(3).max(30),
});

export type SlideGenerada = z.infer<typeof SlideSchemaZ>;
export type PresentacionGenerada = z.infer<typeof PresentacionGeneradaSchemaZ>;

/* ── Schema JSONSchema para Gemini responseSchema (structured output nativo) ── */

const SLIDE_SCHEMA_JSON: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    layout: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ["portada", "bullets", "cita", "comparacion", "imagen", "cierre"],
      description: "Tipo de layout visual de la slide",
    },
    titulo: { type: SchemaType.STRING, description: "Título corto y claro, max 120 chars" },
    bullets: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Lista de 3-6 puntos cortos (max 200 chars cada uno)",
    },
    cuerpo: { type: SchemaType.STRING, description: "Texto libre en layouts sin bullets" },
    cita: { type: SchemaType.STRING, description: "Frase célebre o destacada" },
    notas: { type: SchemaType.STRING, description: "Notas del ponente, max 500 chars" },
  },
  required: ["layout", "titulo"],
};

export const PRESENTACION_SCHEMA_JSON: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    titulo: { type: SchemaType.STRING, description: "Título global de la presentación" },
    slides: {
      type: SchemaType.ARRAY,
      items: SLIDE_SCHEMA_JSON,
      description: "Array de slides en orden",
    },
  },
  required: ["titulo", "slides"],
};

/* ── Prompts ── */

const TONO_INSTRUCCIONES: Record<Tono, string> = {
  formal: "Usa un tono profesional, directo, sin coloquialismos. Frases completas pero concisas.",
  cercano: "Usa un tono cálido y cercano, tutea al lector. Evita la jerga corporativa.",
  motivacional: "Usa un tono inspirador y energético. Frases potentes que inviten a la acción.",
  tecnico: "Usa lenguaje preciso y técnico. Incluye datos, métricas y cifras cuando encajen.",
};

function buildSystem(tono: Tono, idioma: string): string {
  const idiomaNombre =
    { es: "Español", en: "English", fr: "Français", de: "Deutsch", it: "Italiano", pt: "Português" }[
      idioma
    ] ?? "Español";

  return `Eres un experto en diseño de presentaciones corporativas para empresas de hostelería.

Tu trabajo: generar una presentación estructurada a partir del prompt del usuario.

REGLAS ESTRICTAS:
- Idioma: ${idiomaNombre}. TODO el contenido debe estar en este idioma.
- Tono: ${TONO_INSTRUCCIONES[tono]}
- Devuelve JSON válido exactamente con la forma del schema. NADA más.
- La PRIMERA slide debe ser layout "portada".
- La ÚLTIMA slide debe ser layout "cierre".
- Alterna layouts para mantener variedad visual (bullets, cita, comparacion).
- Máximo 6 bullets por slide. Cada bullet máx 200 caracteres.
- Incluye "notas" (del ponente) en cada slide: 2-3 frases que ayuden a hablar sobre la slide.
- Títulos de slide cortos, potentes, 3-8 palabras.
- NO uses emojis en el texto principal (salvo notas).
- NO inventes datos concretos (fechas, cifras, nombres) que no haya proporcionado el usuario.`;
}

function buildUserPrompt(input: GenerarInput): string {
  return `PROMPT DEL USUARIO:
${input.prompt}

${input.audiencia ? `AUDIENCIA: ${input.audiencia}` : ""}
NÚMERO DE SLIDES: ${input.numSlides}

Genera la presentación respetando todas las reglas.`;
}

/* ── API principal ── */

export async function generarPresentacion(input: GenerarInput): Promise<{
  data: PresentacionGenerada;
  tokensInput: number | null;
  tokensOutput: number | null;
  modelo: string;
}> {
  const systemInstruction = buildSystem(input.tono, input.idioma);
  const prompt = buildUserPrompt(input);

  // 1ª llamada
  let raw: unknown;
  let meta: { tokensInput: number | null; tokensOutput: number | null; modelo: string } = {
    tokensInput: null,
    tokensOutput: null,
    modelo: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
  };
  try {
    const r = await geminiJSON<unknown>(prompt, {
      systemInstruction,
      responseSchema: PRESENTACION_SCHEMA_JSON,
    });
    raw = r.data;
    meta = { tokensInput: r.tokensInput, tokensOutput: r.tokensOutput, modelo: r.modelo };
  } catch (err) {
    console.error("[ia-presentacion] primer intento fallido:", err);
    throw err;
  }

  // Parse Zod — si falla, 1 reintento con mensaje correctivo
  const parsed = PresentacionGeneradaSchemaZ.safeParse(raw);
  if (parsed.success) return { data: parsed.data, ...meta };

  console.warn("[ia-presentacion] Zod falló, reintento:", parsed.error.message);
  const r2 = await geminiJSON<unknown>(
    `${prompt}\n\nTU RESPUESTA ANTERIOR NO CUMPLÍA EL SCHEMA. Errores: ${parsed.error.message}\nDEVUELVE SÓLO JSON VÁLIDO.`,
    { systemInstruction, responseSchema: PRESENTACION_SCHEMA_JSON, temperature: 0.3 },
  );
  const parsed2 = PresentacionGeneradaSchemaZ.safeParse(r2.data);
  if (!parsed2.success) {
    throw new Error(`IA devolvió JSON inválido tras reintento: ${parsed2.error.message}`);
  }
  return {
    data: parsed2.data,
    tokensInput: (meta.tokensInput ?? 0) + (r2.tokensInput ?? 0),
    tokensOutput: (meta.tokensOutput ?? 0) + (r2.tokensOutput ?? 0),
    modelo: r2.modelo,
  };
}

/* ── Regenerar 1 slide con contexto ── */

export async function regenerarSlide(params: {
  tituloPresentacion: string;
  promptOriginal: string;
  tono: Tono;
  idioma: string;
  slideActual: { orden: number; layout: string; titulo: string | null };
  contextoSlides: { orden: number; titulo: string | null }[];
}): Promise<SlideGenerada> {
  const { tituloPresentacion, promptOriginal, tono, idioma, slideActual, contextoSlides } = params;
  const systemInstruction = buildSystem(tono, idioma);

  const prompt = `PRESENTACIÓN: "${tituloPresentacion}"
PROMPT ORIGINAL: ${promptOriginal}

CONTEXTO DE LAS DEMÁS SLIDES (orden · título):
${contextoSlides.map((s) => `  ${s.orden}. ${s.titulo ?? "(sin título)"}`).join("\n")}

REGENERA ÚNICAMENTE la slide en posición ${slideActual.orden} (layout actual: ${slideActual.layout}, título actual: "${slideActual.titulo ?? ""}").
Mantén coherencia con las demás. Devuelve 1 slide con la forma del schema.`;

  const r = await geminiJSON<unknown>(prompt, {
    systemInstruction,
    responseSchema: SLIDE_SCHEMA_JSON,
    temperature: 0.7,
  });
  const parsed = SlideSchemaZ.safeParse(r.data);
  if (!parsed.success) throw new Error(`Slide inválida: ${parsed.error.message}`);
  return parsed.data;
}
