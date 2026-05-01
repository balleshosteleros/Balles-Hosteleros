import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { geminiJSON, GeminiKeyMissingError } from "@/lib/ia/gemini";

const InputSchema = z.object({
  borrador: z.string().max(8000).optional().default(""),
  asunto: z.string().max(500).optional().default(""),
  destinatario: z.string().max(200).optional().default(""),
  modo: z.enum(["mejorar", "responder", "reenviar", "redactar"]).default("mejorar"),
  tono: z
    .enum(["profesional", "cercano", "directo", "formal", "amistoso"])
    .default("profesional"),
  longitud: z.enum(["corto", "medio", "largo"]).default("medio"),
  idioma: z.string().max(10).default("es"),
  instruccion: z.string().max(1000).optional().default(""),
  emailOriginal: z
    .object({
      remitente: z.string().max(200).optional().default(""),
      asunto: z.string().max(500).optional().default(""),
      cuerpo: z.string().max(12000).optional().default(""),
    })
    .optional(),
});

const ResponseSchema = {
  type: "object",
  properties: {
    asunto: { type: "string" },
    cuerpo: { type: "string" },
  },
  required: ["asunto", "cuerpo"],
} as const;

const SYSTEM = `Eres un asistente de redacción de correos profesionales para un grupo de restauración (hostelería).
Reglas:
- Respondes SOLO con JSON válido según el esquema { asunto, cuerpo }.
- El "cuerpo" se entrega en texto plano con saltos de línea reales (\\n). NUNCA HTML, NUNCA Markdown, sin asteriscos ni comillas decorativas.
- Mantén el idioma indicado por el usuario (por defecto español de España).
- No inventes datos concretos (cifras, fechas, nombres, direcciones) que no estén en el contexto. Si faltan, deja un placeholder claro entre corchetes [como esto].
- Sé natural, claro y útil. Evita relleno corporativo vacío y frases hechas.
- Termina con una despedida breve y la firma "[Tu nombre]" salvo que el borrador ya incluya una firma; en ese caso respétala.
- Si el usuario te da una "instruccion" extra (p.ej. "más corto", "incluye que vamos mañana"), aplícala con prioridad.
- Si el usuario solo te pasa instrucciones y un borrador vacío o muy pobre, redacta el correo desde cero.`;

function construirPrompt(input: z.infer<typeof InputSchema>): string {
  const lineas: string[] = [];

  const modoTxt: Record<string, string> = {
    mejorar: "Reescribe y mejora el siguiente borrador de correo, manteniendo la intención original.",
    responder: "Redacta una respuesta al correo recibido, basándote en el borrador del usuario (puede estar vacío).",
    reenviar: "Redacta el mensaje que acompaña al reenvío del correo siguiente.",
    redactar: "Redacta un correo nuevo a partir de la instrucción del usuario.",
  };
  lineas.push(modoTxt[input.modo]);
  lineas.push("");

  lineas.push(`Tono: ${input.tono}`);
  lineas.push(`Longitud objetivo: ${input.longitud}`);
  lineas.push(`Idioma: ${input.idioma}`);
  if (input.instruccion?.trim()) {
    lineas.push(`Instrucción extra del usuario: ${input.instruccion.trim()}`);
  }
  lineas.push("");

  if (input.destinatario) {
    lineas.push(`Destinatario: ${input.destinatario}`);
  }
  if (input.asunto) {
    lineas.push(`Asunto actual del borrador: ${input.asunto}`);
  }
  lineas.push("");

  if (input.emailOriginal && (input.emailOriginal.cuerpo || input.emailOriginal.asunto)) {
    lineas.push("=== Correo original al que se responde / reenvía ===");
    if (input.emailOriginal.remitente) lineas.push(`De: ${input.emailOriginal.remitente}`);
    if (input.emailOriginal.asunto) lineas.push(`Asunto: ${input.emailOriginal.asunto}`);
    lineas.push("");
    lineas.push(input.emailOriginal.cuerpo);
    lineas.push("=== Fin del correo original ===");
    lineas.push("");
  }

  lineas.push("=== Borrador del usuario ===");
  lineas.push(input.borrador?.trim() || "(vacío)");
  lineas.push("=== Fin del borrador ===");
  lineas.push("");
  lineas.push(
    "Devuelve SOLO el JSON con { asunto, cuerpo }. Si no quieres cambiar el asunto, repite el actual.",
  );

  return lineas.join("\n");
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const input = InputSchema.parse(body);

    if (!input.borrador?.trim() && !input.instruccion?.trim() && !input.emailOriginal?.cuerpo) {
      return NextResponse.json(
        { error: "Necesitas escribir un borrador o una instrucción para que la IA trabaje." },
        { status: 400 },
      );
    }

    try {
      const res = await geminiJSON<{ asunto: string; cuerpo: string }>(
        construirPrompt(input),
        {
          systemInstruction: SYSTEM,
          responseSchema: ResponseSchema as never,
          temperature: 0.6,
        },
      );

      return NextResponse.json({
        ok: true,
        asunto: res.data.asunto,
        cuerpo: res.data.cuerpo,
        modelo: res.modelo,
        tokens: {
          input: res.tokensInput,
          output: res.tokensOutput,
        },
      });
    } catch (err) {
      if (err instanceof GeminiKeyMissingError) {
        return NextResponse.json(
          { error: "GEMINI_API_KEY no configurada en el servidor." },
          { status: 412 },
        );
      }
      const msg = err instanceof Error ? err.message : "Error generando con IA";
      console.error("[api/google/gmail/ai-redactar]", msg);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Input inválido", detalles: err.issues },
        { status: 400 },
      );
    }
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[api/google/gmail/ai-redactar][outer]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const maxDuration = 30;
