import { NextResponse } from "next/server";
import { openrouterChat } from "@/lib/ia/openrouter";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/shared/lib/rate-limit-memory";
import { getModulosVisibles } from "@/lib/soporte/modulos-visibles";
import { buscarConocimiento } from "@/features/soporte/services/buscar-conocimiento";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rl = rateLimit(`soporte-ayuda:${user.id}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Demasiadas consultas, espera un momento." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  const { pregunta } = (await request.json().catch(() => ({}))) as { pregunta?: string };
  if (!pregunta || pregunta.trim().length < 3) {
    return NextResponse.json({ texto: "Cuéntame con un poco más de detalle qué necesitas saber." });
  }

  // Candado de rol server-side + búsqueda RAG filtrada.
  const { modulos } = await getModulosVisibles();
  const chunks = await buscarConocimiento(pregunta, modulos, 4);

  if (chunks.length === 0) {
    return NextResponse.json({
      texto:
        "No he encontrado nada en tu manual para esa pregunta. Pulsa abajo para hablar con tu jefe directo, te ayudará en cuanto pueda.",
      fuente: "Sin resultados",
    });
  }

  const top = chunks[0];
  const videoUrl = top.videos?.[0]?.url;

  // Resumen con IA usando SOLO los chunks permitidos como contexto.
  const contexto = chunks.map((c) => `## ${c.titulo}\n${c.contenido}`).join("\n\n");
  const aiResponse = await openrouterChat([
    {
      role: "system",
      content:
        "Eres el asistente de Balles Hosteleros, un SaaS de gestión hostelera. Responde en español, en tono claro y muy sencillo (empleados no técnicos). Usa SOLO la información del contexto. Si no está en el contexto, di amablemente que no lo tienes y sugiere hablar con el jefe directo. No inventes. Máximo 6 frases.",
    },
    {
      role: "user",
      content: `CONTEXTO (manual de la plataforma):\n${contexto}\n\nPREGUNTA DEL EMPLEADO: ${pregunta}`,
    },
  ]);

  return NextResponse.json({
    texto: aiResponse ?? top.contenido,
    videoUrl,
    fuente: aiResponse ? "IA · Asistente Balles" : top.titulo,
  });
}
