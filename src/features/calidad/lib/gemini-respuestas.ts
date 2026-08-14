/**
 * Generación de respuestas a reseñas con Gemini.
 *
 * Wraps `geminiJSON` para devolver respuestas estructuradas, lo que evita
 * que el modelo se invente preámbulos / markdown / saludos no pedidos.
 */
import { geminiJSON } from "@/lib/ia/gemini";
import type {
  AgenteIA,
  IdiomaAgente,
  Resena,
} from "@/features/calidad/types/resenas";
import { TONO_LABEL } from "@/features/calidad/types/resenas";

const IDIOMA_INSTRUCCION: Record<IdiomaAgente, string> = {
  dinamico:
    "Detecta el idioma de la reseña original y responde EN EL MISMO IDIOMA.",
  es: "Responde SIEMPRE en español.",
  en: "Reply ALWAYS in English.",
  fr: "Réponds TOUJOURS en français.",
  it: "Rispondi SEMPRE in italiano.",
  pt: "Responde SEMPRE em português.",
  de: "Antworte IMMER auf Deutsch.",
};

interface GenerarOpts {
  agente: AgenteIA;
  resena: Resena;
  empresaNombre: string;
}

export interface RespuestaGenerada {
  texto: string;
  tokensInput: number | null;
  tokensOutput: number | null;
}

export async function generarRespuestaConAgente(
  opts: GenerarOpts,
): Promise<RespuestaGenerada> {
  const { agente, resena, empresaNombre } = opts;

  const tonos = agente.tonos
    .filter((t) => t !== "sin_tono")
    .map((t) => TONO_LABEL[t])
    .join(" y ");
  const instruccionTono = tonos
    ? `Usa un tono ${tonos.toLowerCase()}.`
    : "Tono neutro.";

  const instruccionIdioma = IDIOMA_INSTRUCCION[agente.idioma];

  const ratingDesc = resena.rating ? `${resena.rating}/5 estrellas` : "sin puntuación";

  const comentario =
    resena.comentario?.trim() ||
    "(El cliente no dejó comentario, solo la puntuación.)";

  const reglas = [
    "Eres el propietario respondiendo en Google a una reseña.",
    `Restaurante: ${empresaNombre}.`,
    instruccionIdioma,
    instruccionTono,
    "Personaliza la respuesta — menciona algo concreto que diga la reseña.",
    // Regla dura: se detectó a la IA añadiendo a una reseña sobre música alta
    // un "y que salieras con la garganta destrozada" que el cliente NUNCA
    // escribió. Inventar en una respuesta pública es lo más grave que puede
    // pasar aquí, así que se prohíbe de forma explícita y con ejemplo.
    "PROHIBIDO inventar. Solo puedes referirte a hechos escritos LITERALMENTE en la reseña. " +
      "No añadas consecuencias, síntomas ni detalles que el cliente no haya mencionado, " +
      "aunque parezcan deducirse de lo que dice. Si la reseña solo da una puntuación sin texto, " +
      "agradece en general y NO supongas qué le gustó.",
    "No saludes con clichés tipo 'Estimado cliente'. Empieza por el NOMBRE DE PILA del cliente " +
      "(solo la primera palabra del nombre, nunca los apellidos) y continúa la frase en " +
      "minúscula tras la coma: 'Blanca, gracias por…', nunca 'Blanca, Gracias por…'.",
    "No termines con saludos genéricos tipo 'Atentamente'. El pie de página se añade después.",
    "Sé natural y humano, no robótico.",
    "Si la reseña es negativa, reconoce el problema y ofrece resolverlo (email, teléfono, próxima visita).",
    "Si la reseña es positiva, agradece de forma específica.",
    "Longitud: 2-4 frases máximo. Las respuestas largas no se leen.",
  ];

  const prompt = `
Genera una respuesta para esta reseña de Google:

Cliente: ${resena.nombre_comensal}
Puntuación: ${ratingDesc}
Comentario: ${comentario}

Reglas:
${reglas.map((r) => `- ${r}`).join("\n")}

${agente.instrucciones ? `Instrucciones adicionales del propietario:\n${agente.instrucciones}` : ""}
`.trim();

  const result = await geminiJSON<{ respuesta: string }>(prompt, {
    responseSchema: {
      type: "object",
      properties: {
        respuesta: {
          type: "string",
          description: "Texto plano de la respuesta. Sin markdown.",
        },
      },
      required: ["respuesta"],
    } as Parameters<typeof geminiJSON>[1]["responseSchema"],
    // 0.7 daba demasiada libertad creativa para un texto que se publica en la
    // ficha pública del restaurante: es lo que llevó a la IA a adornar una
    // reseña con detalles que el cliente no había escrito. 0.4 mantiene la
    // respuesta natural pero mucho más pegada a lo que dice la reseña.
    temperature: 0.4,
  });

  let texto = result.data.respuesta.trim();
  if (agente.pie_pagina?.trim()) {
    texto = `${texto}\n\n${agente.pie_pagina.trim()}`;
  }

  return {
    texto,
    tokensInput: result.tokensInput,
    tokensOutput: result.tokensOutput,
  };
}
