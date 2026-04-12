import { NextResponse } from "next/server";
import { openrouterChat, type ChatMsg } from "@/lib/ia/openrouter";
import { BASE_CONOCIMIENTO } from "@/lib/soporte/base-conocimiento";

type MensajeIn = { rol: "user" | "ai" | "humano"; texto: string };

const SYSTEM = `Eres el asistente de soporte de Balles Hosteleros (un SaaS de gestión hostelera).

Tu trabajo:
- Responder dudas de empleados sobre cómo usar la plataforma.
- Hablar en español, lenguaje sencillo, tono cercano (los empleados no son técnicos).
- Si la duda está fuera de tu base de conocimiento, o el empleado pide hablar con una persona, RESPONDE con el JSON exactamente:
  {"escalar": true, "respuesta": "Voy a avisar a tu jefe directo, te contestará en cuanto pueda."}
- Si puedes resolver la duda, RESPONDE con el JSON:
  {"escalar": false, "respuesta": "<tu respuesta>"}

NO inventes funcionalidades. Solo usa lo que está en el manual.`;

const CONTEXTO = BASE_CONOCIMIENTO.map(
  (a) => `## ${a.pregunta}\n${a.respuesta}`,
).join("\n\n");

export async function POST(request: Request) {
  const { mensajes } = (await request.json().catch(() => ({}))) as {
    mensajes?: MensajeIn[];
  };

  if (!mensajes || mensajes.length === 0) {
    return NextResponse.json({
      respuesta: "No he recibido ningún mensaje.",
      escalar: false,
    });
  }

  // Detección rápida de "quiero hablar con persona"
  const ultimaUser = [...mensajes]
    .reverse()
    .find((m) => m.rol === "user");
  if (ultimaUser) {
    const t = ultimaUser.texto.toLowerCase();
    if (
      t.includes("persona") ||
      t.includes("humano") ||
      t.includes("jefe") ||
      t.includes("responsable") ||
      t.includes("hablar con alguien")
    ) {
      return NextResponse.json({
        escalar: true,
        respuesta:
          "Sin problema, voy a avisar a tu jefe directo. Te contestará en cuanto pueda. Mientras tanto puedes seguir escribiendo aquí.",
      });
    }
  }

  // Convertimos al formato OpenAI
  const chat: ChatMsg[] = [
    { role: "system", content: `${SYSTEM}\n\nMANUAL:\n${CONTEXTO}` },
    ...mensajes.map<ChatMsg>((m) => ({
      role: m.rol === "user" ? "user" : "assistant",
      content: m.texto,
    })),
  ];

  const aiRaw = await openrouterChat(chat);

  if (!aiRaw) {
    // Sin IA configurada — fallback que resuelve con la base directamente
    const ultima = ultimaUser?.texto.toLowerCase() ?? "";
    const match = BASE_CONOCIMIENTO.find((a) =>
      a.palabras_clave.some((k) => ultima.includes(k.toLowerCase())),
    );
    if (match) {
      return NextResponse.json({
        escalar: false,
        respuesta: match.respuesta,
      });
    }
    return NextResponse.json({
      escalar: true,
      respuesta:
        "No tengo conexión con la IA ahora mismo. Voy a avisar a tu jefe directo para que te ayude.",
    });
  }

  // Intentamos parsear el JSON de la IA
  try {
    const cleaned = aiRaw
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned) as {
      escalar: boolean;
      respuesta: string;
    };
    return NextResponse.json(parsed);
  } catch {
    // Si la IA no devolvió JSON válido, lo tratamos como respuesta normal
    return NextResponse.json({
      escalar: false,
      respuesta: aiRaw,
    });
  }
}
