"use server";

/**
 * PRP-076 · Fase 1 — "Habla con la web".
 *
 * El usuario pide un cambio en lenguaje natural; la IA devuelve SOLO una lista
 * de retoques de texto (bloque + campo + valor). Nosotros los aplicamos con
 * `aplicarCambios`, que descarta cualquier cosa que no cuadre.
 *
 * Nada de esto toca la web publicada: se escribe en `bloques` (borrador) y se
 * guarda la versión anterior para poder deshacer. Publicar sigue siendo un acto
 * aparte y explícito.
 */
import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/supabase/get-context";
import { geminiJSON, GeminiKeyMissingError } from "@/lib/ia/gemini";
import { SchemaType, type Schema } from "@google/generative-ai";
import {
  aplicarCambios,
  etiquetaCampo,
  resumirTextos,
  type CambioTexto,
} from "../services/chat-textos";
import type { Bloque, PaginaWeb } from "../types";

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

const SYSTEM = `Ayudas al dueño de un restaurante a retocar los TEXTOS de su web hablando en español llano.

Te paso los textos actuales de la web como lista de bloques. Cada bloque tiene
un bloqueId, un tipo y sus textos por campo.

Reglas:
- "campo" debe ser EXACTAMENTE uno de los que te paso para ese bloque. No inventes campos.
- "valor" es el texto nuevo COMPLETO, ya reescrito. No devuelvas instrucciones ni fragmentos.
- Si la petición es ambigua ("quita eso", "cámbialo") NO adivines: devuelve
  cambios vacío y pregunta en "respuesta" a qué se refiere.
- Si piden algo que no es texto (añadir secciones, mover, borrar bloques, fotos),
  devuelve cambios vacío y explica en "respuesta" que de momento solo puedes
  cambiar textos, y que para eso está el editor.
- No inventes datos del negocio (teléfonos, precios, horarios, direcciones).
  Si hacen falta y no los tienes, pídelos.
- Nunca menciones "bloques", "campos", "JSON" ni jerga técnica en "respuesta".`;

/** Fuerza la forma de la respuesta: Gemini no puede devolver otra cosa. */
const ESQUEMA_RESPUESTA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    respuesta: {
      type: SchemaType.STRING,
      description: "Qué has hecho, 1-2 frases en español llano, sin jerga técnica.",
    },
    cambios: {
      type: SchemaType.ARRAY,
      description: "Retoques de texto a aplicar. Vacío si no procede cambiar nada.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          bloqueId: { type: SchemaType.STRING },
          campo: { type: SchemaType.STRING },
          valor: { type: SchemaType.STRING },
        },
        required: ["bloqueId", "campo", "valor"],
      },
    },
  },
  required: ["respuesta", "cambios"],
};

export interface RespuestaChatWeb {
  respuesta: string;
  aplicados: number;
  detalle: string[];
  hayDeshacer: boolean;
}

type CargaPagina =
  | { error: string }
  | {
      error?: undefined;
      supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"];
      empresaId: string;
      pagina: PaginaWeb;
    };

/** Carga la página comprobando que es de la empresa activa. */
async function cargarPagina(paginaId: string): Promise<CargaPagina> {
  const { supabase, empresaId } = await getAppContext();
  if (!empresaId) return { error: "Sin empresa." };
  const { data, error } = await supabase
    .from("paginas_web")
    .select("id, empresa_id, bloques, estado")
    .eq("id", paginaId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (error || !data) return { error: "Página no encontrada." };
  return { supabase, empresaId, pagina: data as unknown as PaginaWeb };
}

export async function enviarMensajeChatWeb(input: {
  paginaId: string;
  mensaje: string;
  historial?: Array<{ rol: "user" | "assistant"; texto: string }>;
}): Promise<ActionResult<RespuestaChatWeb>> {
  try {
    const mensaje = input.mensaje?.trim() ?? "";
    if (!mensaje) return { ok: false, error: "Escribe qué quieres cambiar." };

    const ctx = await cargarPagina(input.paginaId);
    if (ctx.error !== undefined) return { ok: false, error: ctx.error };
    const { supabase, pagina } = ctx;

    const bloques: Bloque[] = Array.isArray(pagina.bloques) ? pagina.bloques : [];
    if (bloques.length === 0) {
      return {
        ok: false,
        error: "Esta web todavía no tiene contenido que retocar.",
      };
    }

    const contexto = JSON.stringify(resumirTextos(bloques), null, 1);

    // Historial reciente en texto plano: Gemini recibe una sola instrucción.
    const historial = (input.historial ?? [])
      .slice(-6)
      .map((m) => `${m.rol === "user" ? "Usuario" : "Tú"}: ${m.texto}`)
      .join("\n");

    const prompt = [
      `TEXTOS ACTUALES DE LA WEB:\n${contexto}`,
      historial ? `\nCONVERSACIÓN PREVIA:\n${historial}` : "",
      `\nPETICIÓN DEL USUARIO:\n${mensaje}`,
    ].join("\n");

    let parsed: { respuesta?: string; cambios?: CambioTexto[] };
    try {
      const { data } = await geminiJSON<{ respuesta: string; cambios: CambioTexto[] }>(
        prompt,
        {
          systemInstruction: SYSTEM,
          responseSchema: ESQUEMA_RESPUESTA,
          temperature: 0.3,
        },
      );
      parsed = data;
    } catch (e) {
      if (e instanceof GeminiKeyMissingError) {
        return {
          ok: false,
          error: "El asistente no está configurado todavía. Avisa a soporte.",
        };
      }
      console.error("[chat-web][gemini]", e);
      return {
        ok: false,
        error: "El asistente no está disponible ahora mismo. Inténtalo en un momento.",
      };
    }

    const cambios = Array.isArray(parsed.cambios) ? parsed.cambios : [];
    const respuesta = (parsed.respuesta ?? "").trim() || "Hecho.";

    if (cambios.length === 0) {
      return {
        ok: true,
        data: { respuesta, aplicados: 0, detalle: [], hayDeshacer: false },
      };
    }

    const { bloques: nuevos, aplicados, descartados } = aplicarCambios(bloques, cambios);

    if (aplicados.length === 0) {
      console.warn("[chat-web] todos descartados:", descartados);
      return {
        ok: true,
        data: {
          respuesta:
            "No he podido hacer ese cambio. Dime con otras palabras qué texto quieres cambiar.",
          aplicados: 0,
          detalle: [],
          hayDeshacer: false,
        },
      };
    }

    // Guardamos la versión PREVIA para deshacer, y luego los bloques nuevos.
    const { error: errUpd } = await supabase
      .from("paginas_web")
      .update({ bloques: nuevos, bloques_previos: bloques })
      .eq("id", input.paginaId);

    if (errUpd) {
      console.error("[chat-web][update]", errUpd.message);
      return { ok: false, error: "No se pudieron guardar los cambios." };
    }

    revalidatePath(`/marketing/pagina-web/${input.paginaId}`);

    const detalle = aplicados.map((c) => `Cambiado el ${etiquetaCampo(c.campo)}`);
    return {
      ok: true,
      data: { respuesta, aplicados: aplicados.length, detalle, hayDeshacer: true },
    };
  } catch (err) {
    console.error("[chat-web][enviar] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

/** Deshace la última intervención del asistente. */
export async function deshacerUltimoCambioChat(
  paginaId: string,
): Promise<ActionResult<{ bloques: Bloque[] }>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const { data, error } = await supabase
      .from("paginas_web")
      .select("bloques_previos")
      .eq("id", paginaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (error || !data) return { ok: false, error: "Página no encontrada." };

    const previos = (data as { bloques_previos: Bloque[] | null }).bloques_previos;
    if (!previos || !Array.isArray(previos) || previos.length === 0) {
      return { ok: false, error: "No hay nada que deshacer." };
    }

    const { error: errUpd } = await supabase
      .from("paginas_web")
      .update({ bloques: previos, bloques_previos: null })
      .eq("id", paginaId);

    if (errUpd) {
      console.error("[chat-web][deshacer]", errUpd.message);
      return { ok: false, error: "No se pudo deshacer." };
    }

    revalidatePath(`/marketing/pagina-web/${paginaId}`);
    return { ok: true, data: { bloques: previos } };
  } catch (err) {
    console.error("[chat-web][deshacer] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}
