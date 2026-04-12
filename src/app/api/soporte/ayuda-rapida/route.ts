import { NextResponse } from "next/server";
import { openrouterChat } from "@/lib/ia/openrouter";
import {
  buscarBase,
  BASE_CONOCIMIENTO,
} from "@/lib/soporte/base-conocimiento";

export async function POST(request: Request) {
  const { pregunta } = (await request.json().catch(() => ({}))) as {
    pregunta?: string;
  };
  if (!pregunta || pregunta.trim().length < 3) {
    return NextResponse.json({
      texto:
        "Cuéntame con un poco más de detalle qué necesitas saber.",
    });
  }

  // 1) Match directo en la base de conocimiento
  const matches = buscarBase(pregunta);
  if (matches.length > 0) {
    const top = matches[0];
    return NextResponse.json({
      texto: top.respuesta,
      videoUrl: top.video_url,
      fuente: top.fuente ?? "Base de conocimiento",
    });
  }

  // 2) Si no hay match, pedimos a la IA que conteste usando la base como contexto
  const contexto = BASE_CONOCIMIENTO.map(
    (a) => `## ${a.pregunta}\n${a.respuesta}`,
  ).join("\n\n");

  const aiResponse = await openrouterChat([
    {
      role: "system",
      content:
        "Eres el asistente de Balles Hosteleros, un SaaS de gestión hostelera. Responde en español, en tono claro y muy sencillo (lenguaje para empleados que no son técnicos). Usa SOLO la información del contexto que te paso. Si no tienes la respuesta exacta, di amablemente que no la tienes y sugiere hablar con el jefe directo. No inventes funcionalidades. Máximo 6 frases.",
    },
    {
      role: "user",
      content: `CONTEXTO (manual de la plataforma):\n${contexto}\n\nPREGUNTA DEL EMPLEADO: ${pregunta}`,
    },
  ]);

  if (aiResponse) {
    return NextResponse.json({
      texto: aiResponse,
      fuente: "IA · Asistente Balles",
    });
  }

  // 3) Sin IA configurada → fallback
  return NextResponse.json({
    texto:
      "No he encontrado nada en la base de información para esa pregunta. Pulsa abajo para hablar con tu jefe directo, te ayudará en cuanto pueda.",
    fuente: "Sin resultados",
  });
}
