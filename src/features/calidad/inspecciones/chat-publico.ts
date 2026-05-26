/**
 * Chat IA público para el inspector externo.
 *
 * Server-only. Resuelve el token público (mismo patrón que /carta/[slug]),
 * arma un contexto MÍNIMO con la información que el inspector ya ve
 * (nombre de empresa, presentación, locales, plantilla con sus secciones
 * y preguntas) y llama a Gemini para responder dudas.
 *
 * Nunca expone empleados, envíos previos, datos internos, configuración
 * ni nada que no esté ya en la página pública del inspector.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { geminiJSON, GeminiKeyMissingError } from "@/lib/ia/gemini";
import type { Schema } from "@google/generative-ai";
import { SchemaType } from "@google/generative-ai";
import type { Slide, SlideBlock, Seccion } from "./types";

export interface ChatMensaje {
  role: "user" | "assistant";
  content: string;
}

export interface ChatPublicoInput {
  token: string;
  mensajes: ChatMensaje[];
}

export type ChatPublicoResult =
  | { ok: true; respuesta: string }
  | { ok: false; error: string };

const MAX_MENSAJES = 20;
const MAX_LEN_MENSAJE = 1500;

function extraerTextoBloque(b: SlideBlock): string {
  switch (b.type) {
    case "title":
    case "subtitle":
    case "paragraph":
    case "note":
      return b.text;
    case "bullets":
      return b.items.map((i) => `• ${i}`).join("\n");
    case "numbered":
      return b.items.map((i, k) => `${k + 1}. ${i.titulo}: ${i.descripcion}`).join("\n");
    case "cards":
      return b.items.map((i) => `• ${i.titulo}: ${i.descripcion}`).join("\n");
    case "icon-row":
      return b.items.map((i) => `• ${i.titulo}: ${i.descripcion}`).join("\n");
    case "buttons":
      return b.items.map((i) => `${i.label} → ${i.href}`).join("\n");
    case "image":
    case "divider":
      return "";
  }
}

function presentacionATexto(slides: Slide[]): string {
  return slides
    .map((s, i) => {
      const textos = s.blocks.map(extraerTextoBloque).filter(Boolean).join("\n");
      return `--- Slide ${i + 1} ---\n${textos}`;
    })
    .filter((s) => s.trim().length > "--- Slide N ---".length)
    .join("\n\n");
}

function plantillaATexto(nombre: string, secciones: Seccion[]): string {
  const bloques = secciones.map((sec) => {
    const preguntas = sec.preguntas
      .map((p) => {
        const obl = p.obligatoria ? " (obligatoria)" : "";
        let tipo = "";
        if (p.tipo === "escala") {
          const min = p.escala_min ?? 0;
          const max = p.escala_max ?? 5;
          const lmin = p.escala_label_min ? ` "${p.escala_label_min}"` : "";
          const lmax = p.escala_label_max ? ` "${p.escala_label_max}"` : "";
          tipo = ` [escala ${min}–${max}${lmin}${lmax}]`;
        } else if (p.tipo === "seleccion" && p.opciones?.length) {
          tipo = ` [opciones: ${p.opciones.join(", ")}]`;
        } else if (p.tipo === "fecha") {
          tipo = " [fecha y hora]";
        } else if (p.tipo === "telefono") {
          tipo = " [teléfono]";
        } else if (p.tipo === "texto_largo") {
          tipo = " [texto largo]";
        } else if (p.tipo === "empleado_select") {
          tipo = " [selecciona empleado de la lista]";
        }
        const ayuda = p.ayuda ? `\n   Ayuda: ${p.ayuda}` : "";
        return `- ${p.enunciado}${tipo}${obl}${ayuda}`;
      })
      .join("\n");
    const desc = sec.descripcion ? `\n${sec.descripcion}` : "";
    return `### ${sec.titulo}${desc}\n${preguntas}`;
  });
  return `Plantilla: ${nombre}\n\n${bloques.join("\n\n")}`;
}

function instruccionesSistema(empresaNombre: string, presentacion: string, plantilla: string, locales: string): string {
  return `Eres un asistente DENTRO del formulario de inspección de "${empresaNombre}".
Tu único trabajo es ayudar al inspector externo que está rellenando esta inspección
a entender las instrucciones, las preguntas, qué responder y cómo puntuar.

REGLAS ESTRICTAS:
- Responde SOLO sobre esta inspección concreta (la presentación, las preguntas, los
  locales que ves abajo, cómo rellenar el formulario, criterios de puntuación).
- Si te preguntan algo fuera de eso (datos internos del restaurante, otros inspectores,
  empleados, contabilidad, recetas, sueldos, datos personales, software, etc.) responde
  amablemente: "Solo puedo ayudarte con esta inspección. Para otras dudas, contacta con
  el responsable de calidad de ${empresaNombre}." NO inventes nada.
- No reveles que existen otros envíos, otros inspectores, ni datos internos de la empresa.
- No reveles direcciones, teléfonos ni emails internos.
- Responde en español, claro y breve (máximo 4–5 frases salvo que pidan algo paso a paso).
- Usa un tono cordial, profesional y cercano.
- Si la pregunta es sobre una escala numérica, explica los extremos y sugiere criterios
  prácticos basados en lo que dice la plantilla.

INFORMACIÓN DE ESTA INSPECCIÓN (única que puedes usar):

[PRESENTACIÓN MOSTRADA AL INSPECTOR]
${presentacion || "(sin contenido)"}

[LOCALES DISPONIBLES]
${locales || "(ninguno)"}

[PLANTILLA DEL FORMULARIO]
${plantilla}`;
}

export async function responderChatPublico(
  input: ChatPublicoInput,
): Promise<ChatPublicoResult> {
  if (!input.token) return { ok: false, error: "Token faltante" };
  if (!Array.isArray(input.mensajes) || input.mensajes.length === 0) {
    return { ok: false, error: "Mensaje vacío" };
  }
  if (input.mensajes.length > MAX_MENSAJES) {
    return { ok: false, error: "Conversación demasiado larga" };
  }

  const ultimo = input.mensajes[input.mensajes.length - 1];
  if (ultimo.role !== "user" || !ultimo.content?.trim()) {
    return { ok: false, error: "El último mensaje debe ser del usuario" };
  }

  const sanitizados = input.mensajes
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role,
      content: String(m.content ?? "").slice(0, MAX_LEN_MENSAJE),
    }));

  const admin = createAdminClient();

  // 1) Resolver token
  const { data: tokenRow } = await admin
    .from("inspeccion_tokens")
    .select("empresa_id, plantilla_activa_id, activo")
    .eq("token", input.token)
    .maybeSingle();
  if (!tokenRow || !tokenRow.activo || !tokenRow.plantilla_activa_id) {
    return { ok: false, error: "Enlace no válido" };
  }
  const empresaId = tokenRow.empresa_id as string;
  const plantillaId = tokenRow.plantilla_activa_id as string;

  // 2) Empresa (solo nombre)
  const { data: empresa } = await admin
    .from("empresas")
    .select("nombre")
    .eq("id", empresaId)
    .maybeSingle();
  if (!empresa) return { ok: false, error: "Empresa no encontrada" };

  // 3) Locales activos (solo nombre)
  const { data: locales } = await admin
    .from("locales")
    .select("nombre, activo")
    .eq("empresa_id", empresaId)
    .order("nombre");
  const localesTxt = (locales ?? [])
    .filter((l) => l.activo !== false)
    .map((l) => `- ${l.nombre}`)
    .join("\n");

  // 4) Presentación
  const { data: pres } = await admin
    .from("inspeccion_presentaciones")
    .select("slides")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  const slides: Slide[] = (pres?.slides as Slide[] | null) ?? [];
  const presentacionTxt = presentacionATexto(slides);

  // 5) Plantilla vigente
  const { data: plantilla } = await admin
    .from("inspeccion_plantillas")
    .select("nombre")
    .eq("id", plantillaId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!plantilla) return { ok: false, error: "Plantilla no encontrada" };

  const { data: version } = await admin
    .from("inspeccion_plantilla_versiones")
    .select("id")
    .eq("plantilla_id", plantillaId)
    .eq("vigente", true)
    .maybeSingle();
  if (!version) return { ok: false, error: "Plantilla sin versión activa" };

  const { data: secciones } = await admin
    .from("inspeccion_secciones")
    .select("id, titulo, descripcion, orden, empresa_id, version_id")
    .eq("version_id", version.id)
    .order("orden");

  const { data: preguntas } = await admin
    .from("inspeccion_preguntas")
    .select("*")
    .in("seccion_id", (secciones ?? []).map((s) => s.id))
    .order("orden");

  const secs: Seccion[] = (secciones ?? []).map((s) => ({
    id: s.id,
    version_id: s.version_id,
    empresa_id: s.empresa_id,
    orden: s.orden,
    titulo: s.titulo,
    descripcion: s.descripcion,
    preguntas: (preguntas ?? [])
      .filter((p) => p.seccion_id === s.id)
      .map((p) => ({
        id: p.id,
        seccion_id: p.seccion_id,
        empresa_id: p.empresa_id,
        orden: p.orden,
        tipo: p.tipo,
        enunciado: p.enunciado,
        ayuda: p.ayuda,
        obligatoria: p.obligatoria,
        escala_min: p.escala_min,
        escala_max: p.escala_max,
        escala_label_min: p.escala_label_min,
        escala_label_max: p.escala_label_max,
        opciones: p.opciones,
        cuenta_para_nota: p.cuenta_para_nota,
      })),
  }));

  const plantillaTxt = plantillaATexto(plantilla.nombre, secs);
  const systemInstruction = instruccionesSistema(
    empresa.nombre,
    presentacionTxt,
    plantillaTxt,
    localesTxt,
  );

  // 6) Prompt = conversación serializada (Gemini en modo JSON con respuesta única)
  const conversacion = sanitizados
    .map((m) => (m.role === "user" ? `INSPECTOR: ${m.content}` : `ASISTENTE: ${m.content}`))
    .join("\n\n");

  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      respuesta: {
        type: SchemaType.STRING,
        description:
          "Respuesta breve y útil para el inspector. Máximo 4–5 frases salvo lista paso a paso.",
      },
    },
    required: ["respuesta"],
  } as Schema;

  try {
    const res = await geminiJSON<{ respuesta: string }>(
      `Conversación hasta ahora:\n\n${conversacion}\n\nResponde el último mensaje del INSPECTOR.`,
      {
        systemInstruction,
        responseSchema: schema,
        temperature: 0.3,
      },
    );
    const respuesta = (res.data.respuesta ?? "").trim();
    if (!respuesta) return { ok: false, error: "Respuesta vacía" };
    return { ok: true, respuesta };
  } catch (err) {
    if (err instanceof GeminiKeyMissingError) {
      return { ok: false, error: "El chat no está disponible ahora mismo." };
    }
    console.error("[inspectores/chat] ", err);
    return { ok: false, error: "No se pudo procesar tu pregunta." };
  }
}
