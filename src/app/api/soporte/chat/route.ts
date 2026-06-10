import { NextResponse } from "next/server";
import { openrouterChat, type ChatMsg } from "@/lib/ia/openrouter";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/shared/lib/rate-limit-memory";
import { getModulosVisibles } from "@/lib/soporte/modulos-visibles";
import {
  buscarConocimiento,
  type ChunkRecuperado,
} from "@/features/soporte/services/buscar-conocimiento";
import type { RecursoRespuesta } from "@/features/soporte/types";

type MensajeIn = { rol: "user" | "ai" | "humano"; texto: string };

const SYSTEM = `Eres el asistente de soporte de Balles Hosteleros (un SaaS de gestión hostelera).

Reglas:
- Hablas en español, lenguaje sencillo y cercano (los empleados no son técnicos).
- Respondes ÚNICAMENTE con la información del CONTEXTO que te paso. No inventes funcionalidades ni pasos.
- Eres muy resolutivo: explica paso a paso y, si el contexto trae vídeos o enlaces, invita a verlos.
- NUNCA hables de módulos o temas que no estén en el contexto: ese empleado no tiene acceso a ellos.
- Si la duda NO se puede responder con el contexto, o el empleado pide hablar con una persona, escala.

Responde SIEMPRE con un JSON válido y nada más:
- Si resuelves: {"escalar": false, "respuesta": "<tu respuesta paso a paso>"}
- Si no puedes o piden persona: {"escalar": true, "respuesta": "Voy a avisar a tu jefe directo, te contestará en cuanto pueda."}`;

const PEDIR_PERSONA = ["persona", "humano", "jefe", "responsable", "hablar con alguien"];

/** Junta los recursos (vídeos/enlaces) de los chunks usados, deduplicados por URL. */
function recursosDeChunks(chunks: ChunkRecuperado[], max = 5): RecursoRespuesta[] {
  const out: RecursoRespuesta[] = [];
  const vistos = new Set<string>();
  for (const c of chunks) {
    for (const v of c.videos ?? []) {
      if (v.url && !vistos.has(v.url)) {
        vistos.add(v.url);
        out.push({ tipo: "video", titulo: v.titulo || "Vídeo formativo", url: v.url });
      }
    }
    for (const e of c.enlaces ?? []) {
      if (e.url && !vistos.has(e.url)) {
        vistos.add(e.url);
        out.push({ tipo: "enlace", titulo: e.titulo || "Más información", url: e.url });
      }
    }
  }
  return out.slice(0, max);
}

async function registrarConsulta(opts: {
  empresaId: string | null;
  userId: string;
  pregunta: string;
  modulos: string[];
  chunks: ChunkRecuperado[];
  escalo: boolean;
}) {
  if (!opts.empresaId) return; // la tabla exige empresa
  try {
    const admin = createAdminClient();
    await admin.from("soporte_consultas").insert({
      empresa_id: opts.empresaId,
      user_id: opts.userId,
      pregunta: opts.pregunta.slice(0, 2000),
      modulos_permitidos: opts.modulos,
      chunks_usados: opts.chunks.map((c) => c.id),
      escalo: opts.escalo,
    });
  } catch (e) {
    console.error("[soporte_consultas] insert", e);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rl = rateLimit(`soporte-chat:${user.id}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Demasiadas peticiones, espera un momento." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  const { mensajes } = (await request.json().catch(() => ({}))) as {
    mensajes?: MensajeIn[];
  };
  if (!mensajes || mensajes.length === 0) {
    return NextResponse.json({ respuesta: "No he recibido ningún mensaje.", escalar: false });
  }

  const ultimaUser = [...mensajes].reverse().find((m) => m.rol === "user");
  const pregunta = ultimaUser?.texto ?? "";

  // Candado de rol: módulos visibles calculados en SERVIDOR (nunca desde el cliente).
  const { modulos, empresaId } = await getModulosVisibles();

  // Petición explícita de hablar con una persona → escalar directo.
  if (pregunta && PEDIR_PERSONA.some((k) => pregunta.toLowerCase().includes(k))) {
    await registrarConsulta({ empresaId, userId: user.id, pregunta, modulos, chunks: [], escalo: true });
    return NextResponse.json({
      escalar: true,
      respuesta:
        "Sin problema, voy a avisar a tu jefe directo. Te contestará en cuanto pueda. Mientras tanto puedes seguir escribiendo aquí.",
    });
  }

  // Búsqueda RAG filtrada por los módulos permitidos (candado dentro de la query).
  const chunks = await buscarConocimiento(pregunta, modulos, 6);

  // Sin nada que el rol pueda ver sobre esto → escalar sin filtrar info.
  if (chunks.length === 0) {
    await registrarConsulta({ empresaId, userId: user.id, pregunta, modulos, chunks: [], escalo: true });
    return NextResponse.json({
      escalar: true,
      respuesta:
        "No tengo información sobre eso en tu manual. Voy a avisar a tu jefe directo para que te ayude.",
    });
  }

  const contexto = chunks
    .map((c, i) => `### [${i + 1}] ${c.titulo} (módulo ${c.modulo})\n${c.contenido}`)
    .join("\n\n");
  const recursos = recursosDeChunks(chunks);

  const chat: ChatMsg[] = [
    { role: "system", content: `${SYSTEM}\n\nCONTEXTO:\n${contexto}` },
    ...mensajes.map<ChatMsg>((m) => ({
      role: m.rol === "user" ? "user" : "assistant",
      content: m.texto,
    })),
  ];

  const aiRaw = await openrouterChat(chat);

  // Fallback sin IA: respondemos con el chunk más cercano + sus recursos.
  if (!aiRaw) {
    const top = chunks[0];
    await registrarConsulta({ empresaId, userId: user.id, pregunta, modulos, chunks: [top], escalo: false });
    return NextResponse.json({ escalar: false, respuesta: top.contenido, recursos });
  }

  let parsed: { escalar: boolean; respuesta: string };
  try {
    const cleaned = aiRaw.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    parsed = JSON.parse(cleaned) as { escalar: boolean; respuesta: string };
  } catch {
    parsed = { escalar: false, respuesta: aiRaw };
  }

  await registrarConsulta({
    empresaId,
    userId: user.id,
    pregunta,
    modulos,
    chunks: parsed.escalar ? [] : chunks,
    escalo: parsed.escalar,
  });

  // Solo adjuntamos recursos si de verdad resolvimos la duda.
  return NextResponse.json({
    escalar: parsed.escalar,
    respuesta: parsed.respuesta,
    recursos: parsed.escalar ? [] : recursos,
  });
}
