import { NextResponse } from "next/server";
import { chatTexto, type ChatMsg } from "@/lib/ia/chat-texto";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { rateLimit } from "@/shared/lib/rate-limit-memory";
import { getModulosVisibles } from "@/lib/soporte/modulos-visibles";
import { UMBRAL_AJENO, UMBRAL_RELEVANTE } from "@/lib/soporte/umbrales";
import {
  recuperarConocimiento,
  distanciaAlConocimiento,
  type ChunkRecuperado,
} from "@/features/soporte/services/buscar-conocimiento";
import { registrarConsulta } from "@/features/soporte/services/registrar-consulta";
import { apuntarHueco } from "@/features/soporte/services/huecos";
import type { RecursoRespuesta } from "@/features/soporte/types";

type MensajeIn = { rol: "user" | "ai" | "humano"; texto: string };

/**
 * El asistente SOLO sabe lo que hay escrito en el software.
 *
 * No es una promesa que se le pide al modelo y ya está: está montado para que no
 * pueda hacer otra cosa. Si no hay conocimiento suficientemente cercano a la
 * pregunta, ni siquiera se llama a la IA — se responde con el mensaje que toca.
 * Y lo que sí se le pasa está filtrado por los módulos que ve ese rol.
 */
const SYSTEM = `Eres el asistente del software de gestión de Balles Hosteleros. Contestas a los trabajadores de la empresa.

Reglas que NO puedes saltarte:
- Hablas en español, claro y cercano. Quien pregunta no es informático.
- Respondes ÚNICA Y EXCLUSIVAMENTE con lo que venga en el CONTEXTO. El contexto es todo lo que sabes.
- PROHIBIDO usar conocimiento general, tuyo o de internet. Si la respuesta no está en el contexto, NO la sabes, por evidente que te parezca.
- PROHIBIDO inventarte pantallas, botones, menús o pasos que no estén escritos en el contexto.
- No hables de módulos ni de temas que no salgan en el contexto: quien pregunta no tiene acceso a ellos.
- Si el contexto no responde a lo que preguntan, o piden hablar con una persona, escala.
- Ve al grano: explica los pasos, sin rodeos ni presentaciones.

Responde SIEMPRE con un JSON válido y nada más:
- Si lo resuelves con el contexto: {"escalar": false, "respuesta": "<los pasos>"}
- Si no: {"escalar": true, "respuesta": "<una línea diciendo que eso no lo tienes>"}`;

const PEDIR_PERSONA = ["persona", "humano", "jefe", "responsable", "hablar con alguien"];

/** Lo que se contesta cuando la pregunta no es del software. */
const RESPUESTA_AJENA =
  "Eso no es información de la empresa, así que no te lo puedo contestar. " +
  "Yo solo sé de lo que hay dentro del software. Pregúntame por tu horario, tus fichajes, " +
  "tus nóminas o por cualquier pantalla que uses en tu trabajo.";

/** Lo que se contesta cuando sí es del software pero todavía no está escrito. */
const RESPUESTA_SIN_DATOS =
  "Eso todavía no lo tengo explicado. Lo he apuntado y dirección lo revisará para añadirlo, " +
  "así la próxima vez podré contestarte. Si lo necesitas ahora mismo, dime que quieres hablar " +
  "con una persona y aviso a tu responsable.";

/** Junta los recursos (vídeos/enlaces) de los chunks usados, sin repetir URL. */
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
        out.push({ tipo: "enlace", titulo: e.titulo || "Ir a la pantalla", url: e.url });
      }
    }
  }
  return out.slice(0, max);
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

  // Candado de rol: los módulos se calculan en SERVIDOR, nunca se aceptan del
  // navegador. La empresa es la ACTIVA, la del selector de arriba.
  const [{ modulos }, empresaId] = await Promise.all([
    getModulosVisibles(),
    getEmpresaActivaForUser(supabase, user.id),
  ]);

  const base = { empresaId, userId: user.id, pregunta, modulos };

  // Petición explícita de hablar con una persona → escalar directo, sin gastar IA.
  if (pregunta && PEDIR_PERSONA.some((k) => pregunta.toLowerCase().includes(k))) {
    const respuesta =
      "Sin problema, voy a avisar a tu jefe directo. Te contestará en cuanto pueda. " +
      "Mientras tanto puedes seguir escribiendo aquí.";
    await registrarConsulta({
      ...base,
      respuesta,
      chunksUsados: [],
      embedding: null,
      desenlace: "escalada",
    });
    return NextResponse.json({ escalar: true, respuesta });
  }

  // Búsqueda filtrada por los módulos permitidos (el filtro va dentro de la query).
  const { embedding, chunks } = await recuperarConocimiento(pregunta, modulos, 6);

  // ¿Hay algo que de verdad conteste? Si el más cercano queda lejos, no hay
  // nada que contar: no se llama a la IA (ni se gasta) y se elige el mensaje.
  const masCercano = chunks[0]?.distancia ?? 1;
  if (chunks.length === 0 || masCercano > UMBRAL_RELEVANTE) {
    const global = await distanciaAlConocimiento(embedding);
    const esAjena = global.distancia > UMBRAL_AJENO;
    const respuesta = esAjena ? RESPUESTA_AJENA : RESPUESTA_SIN_DATOS;

    const consultaId = await registrarConsulta({
      ...base,
      respuesta,
      chunksUsados: [],
      embedding,
      desenlace: esAjena ? "ajena" : "sin_datos",
    });

    // Solo se apunta como hueco lo que parece del software. Lo de fuera no es
    // trabajo pendiente de nadie.
    if (!esAjena) {
      await apuntarHueco({
        empresaId,
        pregunta,
        embedding,
        moduloProbable: global.modulo,
        consultaId,
      });
    }

    return NextResponse.json({ escalar: false, respuesta, recursos: [] });
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

  const aiRaw = await chatTexto(chat);

  // Sin IA disponible: se responde con el artículo más cercano tal cual. Es
  // conocimiento real del software, así que sigue sin inventarse nada.
  if (!aiRaw) {
    const top = chunks[0];
    await registrarConsulta({
      ...base,
      respuesta: top.contenido,
      chunksUsados: [top.id],
      embedding,
      desenlace: "resuelta",
    });
    return NextResponse.json({ escalar: false, respuesta: top.contenido, recursos });
  }

  let parsed: { escalar: boolean; respuesta: string };
  try {
    const cleaned = aiRaw.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    parsed = JSON.parse(cleaned) as { escalar: boolean; respuesta: string };
  } catch {
    parsed = { escalar: false, respuesta: aiRaw };
  }

  // La IA ha leído el contexto y dice que no le sirve: eso es un hueco real,
  // aunque la búsqueda hubiera traído algo cercano.
  if (parsed.escalar) {
    const consultaId = await registrarConsulta({
      ...base,
      respuesta: RESPUESTA_SIN_DATOS,
      chunksUsados: [],
      embedding,
      desenlace: "sin_datos",
    });
    await apuntarHueco({
      empresaId,
      pregunta,
      embedding,
      moduloProbable: chunks[0]?.modulo ?? null,
      consultaId,
    });
    return NextResponse.json({ escalar: false, respuesta: RESPUESTA_SIN_DATOS, recursos: [] });
  }

  await registrarConsulta({
    ...base,
    respuesta: parsed.respuesta,
    chunksUsados: chunks.map((c) => c.id),
    embedding,
    desenlace: "resuelta",
  });

  return NextResponse.json({ escalar: false, respuesta: parsed.respuesta, recursos });
}
