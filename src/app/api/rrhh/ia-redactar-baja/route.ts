/**
 * Redacta con IA los HECHOS de una carta de comunicación de baja/despido.
 *
 * Mismo patrón que `/api/google/gmail/ai-redactar` (Gemini + JSON validado),
 * pero con reglas OPUESTAS: aquí se busca registro formal, no cercanía.
 *
 * REGLA CRÍTICA: la IA reformula, NUNCA inventa. Una carta de despido con
 * hechos, fechas o advertencias que no ocurrieron es lo que la tumba ante una
 * inspección o un juzgado. Si un dato falta, la IA deja un hueco [entre
 * corchetes] para que lo rellene RRHH; no lo rellena ella.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { geminiJSON, GeminiKeyMissingError, MODELO_REDACCION } from "@/lib/ia/gemini";

const InputSchema = z.object({
  /** Hechos en bruto tal y como los escribe RRHH. */
  borrador: z.string().max(6000),
  /** Etiqueta del tipo de baja (Disciplinaria, Fin de contrato…). */
  tipoBajaLabel: z.string().max(120).optional().default(""),
  /** Instrucción puntual para esta redacción («más breve», «más formal»…). */
  instruccion: z.string().max(1000).optional().default(""),
});

const ResponseSchema = {
  type: "object",
  properties: {
    hechos: { type: "string" },
  },
  required: ["hechos"],
} as const;

const SYSTEM = `Eres un asistente de RRHH que redacta la exposición de HECHOS de una carta de comunicación de baja de contrato (despido o fin de contrato) en una empresa de hostelería en España.

Respondes SOLO con JSON válido según el esquema { hechos }.

QUÉ DEVUELVES
- Únicamente el bloque de hechos que se insertará en la carta. Texto plano con saltos de línea reales (\\n). Nunca HTML ni Markdown, sin asteriscos ni viñetas decorativas.
- No escribas encabezados, ni fecha, ni destinatario, ni despedida, ni firma: la carta ya los pone. Empiezas directamente por los hechos.
- Español de España.

PROHIBIDO INVENTAR — ESTA ES LA REGLA MÁS IMPORTANTE
- Cambias CÓMO se dice, nunca QUÉ se dice. Reformulas y ordenas lo que te han escrito.
- Está terminantemente prohibido añadir hechos, fechas, horas, importes, números de incidencias, advertencias previas, testigos, sanciones o antecedentes que no estén en el borrador.
- Si un dato necesario falta (una fecha, el número de avisos previos, el detalle de un incidente), NO lo inventes ni lo estimes: deja un hueco explícito entre corchetes, por ejemplo [fecha del incidente] o [número de avisos previos]. Es preferible un hueco visible a un dato falso.
- No deduzcas ni extrapoles. Si el borrador dice "llegó tarde varias veces", no escribas "en reiteradas ocasiones durante los últimos tres meses" salvo que el plazo esté escrito.

REGISTRO Y ESTILO
- Registro formal y neutro, propio de una comunicación laboral escrita. Trata al trabajador de usted.
- Hechos objetivos, concretos y fechados. Cada hecho, una idea. Frases claras y sin subordinadas largas.
- PROHIBIDAS las valoraciones sobre la persona ("es un vago", "mala actitud", "poco profesional", "no encaja"). Se describe la CONDUCTA y sus fechas, nunca el carácter de quien la comete.
- Sin adjetivos innecesarios, sin ironía, sin reproches y sin disculpas.
- Ordena los hechos cronológicamente cuando haya fechas.

LÍMITES DE CONTENIDO
- No añadas consecuencias, cuantías, indemnizaciones, liquidaciones, finiquitos, plazos de impugnación, renuncias ni referencias a preavisos que no estén en el borrador.
- No cites artículos del Estatuto de los Trabajadores ni del convenio salvo que vengan escritos en el borrador.
- No añadas ofrecimientos ni próximos pasos que no haya escrito quien redacta.

Si el borrador es muy pobre, redacta con lo que hay y marca con corchetes lo que falte. "Redactar desde cero" se refiere a la redacción, jamás a inventar contenido.`;

function construirPrompt(input: z.infer<typeof InputSchema>): string {
  const lineas: string[] = [];

  lineas.push(
    "Reescribe los siguientes hechos para la carta de comunicación de baja, manteniendo íntegramente su contenido.",
  );
  lineas.push("");

  if (input.tipoBajaLabel?.trim()) {
    lineas.push(`Tipo de baja: ${input.tipoBajaLabel.trim()}`);
    lineas.push("");
  }

  if (input.instruccion?.trim()) {
    lineas.push(
      `Instrucción SOLO para esta redacción (manda sobre lo anterior, pero NUNCA sobre la prohibición de inventar): ${input.instruccion.trim()}`,
    );
    lineas.push("");
  }

  lineas.push("=== Hechos escritos por RRHH ===");
  lineas.push(input.borrador.trim());
  lineas.push("=== Fin de los hechos ===");
  lineas.push("");
  lineas.push(
    "Devuelve SOLO el JSON { hechos }. Recuerda: ningún dato que no esté arriba; lo que falte, entre corchetes.",
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

    if (!input.borrador.trim()) {
      return NextResponse.json(
        { error: "Escribe los hechos antes de pedir ayuda a la IA." },
        { status: 400 },
      );
    }

    try {
      const res = await geminiJSON<{ hechos: string }>(construirPrompt(input), {
        // Texto que leerá una persona (y que acaba en un documento legal):
        // usa el modelo de redacción, no el de extraer datos.
        model: MODELO_REDACCION,
        feature: "rrhh.carta_baja",
        systemInstruction: SYSTEM,
        responseSchema: ResponseSchema as never,
        // Temperatura baja: aquí interesa fidelidad al borrador, no creatividad.
        temperature: 0.3,
      });

      return NextResponse.json({
        ok: true,
        hechos: res.data.hechos,
        modelo: res.modelo,
        tokens: { input: res.tokensInput, output: res.tokensOutput },
      });
    } catch (err) {
      if (err instanceof GeminiKeyMissingError) {
        return NextResponse.json(
          { error: "GEMINI_API_KEY no configurada en el servidor." },
          { status: 412 },
        );
      }
      const msg = err instanceof Error ? err.message : "Error generando con IA";
      console.error("[api/rrhh/ia-redactar-baja]", msg);
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
    console.error("[api/rrhh/ia-redactar-baja][outer]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const maxDuration = 30;
