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
import {
  colocarFotos,
  destinosDisponibles,
  type FotoAColocar,
} from "../services/chat-fotos";
import type { Bloque, PaginaWeb } from "../types";
import { friendlyError } from "@/shared/lib/friendly-errors";

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
- Si piden algo que no es texto (añadir o quitar secciones, moverlas, fotos,
  enlaces, colores), devuelve cambios vacío y explica en "respuesta" QUÉ tiene
  que hacer esa persona para conseguirlo, en cristiano. Guía práctica:
  · Fotos → se suben desde el editor, en la sección correspondiente.
  · Colores y logotipo → Ajustes, Imagen de marca. Cambiarlo ahí cambia la web.
  · Enlaces y botones → en el editor, para no romper la navegación.
  · Orden de las secciones → arrastrando en el editor.
  · Platos y precios → salen del módulo de Cocina, no de la web.
  · Dirección, teléfono y horarios → Ajustes, Datos generales.
- No inventes datos del negocio (teléfonos, precios, horarios, direcciones,
  valoraciones, número de seguidores, premios). Si hacen falta y no los tienes,
  pídelos. Nunca te inventes un testimonio ni una reseña: son de personas reales.

FOTOS ADJUNTAS:
- Si te adjuntan fotos, te paso su url y la lista de DESTINOS POSIBLES de esta web.
- Pon cada foto en "fotos" con su url exacta y la CLAVE de un destino de esa lista.
  No inventes claves ni uses una que no esté en la lista.
- Coloca una foto SOLO si la persona ha dicho dónde va ("esta para la portada",
  "estas para la carta"). Si no lo ha dicho, o si hay varias fotos y no está
  claro cuál va dónde, devuelve "fotos" vacío y PREGUNTA en "respuesta" a qué
  sección va cada una, nombrando los destinos posibles en cristiano.
- "alt" es una descripción corta de lo que se ve, para quien no puede ver la
  imagen y para Google. Describe solo lo evidente; no te inventes el plato ni el
  sitio si no te lo han dicho.
- Nunca menciones "bloques", "campos", "JSON" ni jerga técnica en "respuesta".`;

/** Fuerza la forma de la respuesta: Gemini no puede devolver otra cosa. */
const ESQUEMA_RESPUESTA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    respuesta: {
      type: SchemaType.STRING,
      description: "Qué has hecho, 1-2 frases en español llano, sin jerga técnica.",
    },
    fotos: {
      type: SchemaType.ARRAY,
      description:
        "Dónde va cada foto adjunta. Una entrada por foto que sepas colocar; vacío si no lo tienes claro.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          url: { type: SchemaType.STRING, description: "La url exacta de la foto adjunta." },
          destino: { type: SchemaType.STRING, description: "Clave del destino elegido." },
          alt: {
            type: SchemaType.STRING,
            description: "Descripción corta de la foto, para accesibilidad y SEO.",
          },
        },
        required: ["url", "destino", "alt"],
      },
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
  required: ["respuesta", "cambios", "fotos"],
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
    .select("id, empresa_id, bloques, estado, legal_tipo")
    .eq("id", paginaId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (error || !data) return { error: "Página no encontrada." };

  // Los documentos legales no los reescribe ni el asistente: su contenido sale
  // de Ajustes → Datos generales y se regenera desde allí.
  if ((data as { legal_tipo: string | null }).legal_tipo) {
    return {
      error:
        "Esta página legal se genera con los datos de la empresa. Para cambiarla, edita Ajustes → Datos generales y vuelve a generarla.",
    };
  }

  return { supabase, empresaId, pagina: data as unknown as PaginaWeb };
}

export async function enviarMensajeChatWeb(input: {
  paginaId: string;
  mensaje: string;
  historial?: Array<{ rol: "user" | "assistant"; texto: string }>;
  /** Fotos YA subidas al bucket por el navegador, listas para colocar. */
  fotos?: Array<{ url: string; nombre: string }>;
}): Promise<ActionResult<RespuestaChatWeb>> {
  try {
    const mensaje = input.mensaje?.trim() ?? "";
    const fotosAdjuntas = (input.fotos ?? []).filter((f) => f.url?.trim());
    // Con fotos adjuntas no hace falta escribir nada: adjuntar y decir "para la
    // portada" en el mismo envío es lo normal, pero soltar la foto sola también.
    if (!mensaje && fotosAdjuntas.length === 0) {
      return { ok: false, error: "Escribe qué quieres cambiar." };
    }

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

    const destinos = destinosDisponibles(bloques);
    const bloqueFotos = fotosAdjuntas.length
      ? [
          `\nFOTOS ADJUNTAS (${fotosAdjuntas.length}):`,
          ...fotosAdjuntas.map((f, i) => `  ${i + 1}. url: ${f.url} · archivo: "${f.nombre}"`),
          `\nDESTINOS POSIBLES EN ESTA WEB:`,
          ...destinos.map((d) => `  · ${d.clave} — ${d.etiqueta}. ${d.ayuda}`),
        ].join("\n")
      : "";

    const prompt = [
      `TEXTOS ACTUALES DE LA WEB:\n${contexto}`,
      bloqueFotos,
      historial ? `\nCONVERSACIÓN PREVIA:\n${historial}` : "",
      `\nPETICIÓN DEL USUARIO:\n${mensaje || "(solo ha adjuntado fotos, sin texto)"}`,
    ].join("\n");

    let parsed: { respuesta?: string; cambios?: CambioTexto[]; fotos?: FotoAColocar[] };
    try {
      const { data } = await geminiJSON<{
        respuesta: string;
        cambios: CambioTexto[];
        fotos: FotoAColocar[];
      }>(
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
    const fotos = Array.isArray(parsed.fotos) ? parsed.fotos : [];
    const respuesta = (parsed.respuesta ?? "").trim() || "Hecho.";

    if (cambios.length === 0 && fotos.length === 0) {
      // Ni textos ni fotos colocadas: la IA está preguntando algo. Si había
      // fotos adjuntas se quedan sin colocar, y hay que decirlo — si no, el
      // cliente cree que ya están puestas.
      const aviso =
        fotosAdjuntas.length > 0
          ? `${respuesta}\n\n(De momento no he colocado ${
              fotosAdjuntas.length === 1 ? "la foto" : "las fotos"
            }.)`
          : respuesta;
      return {
        ok: true,
        data: { respuesta: aviso, aplicados: 0, detalle: [], hayDeshacer: false },
      };
    }

    // Las fotos se colocan primero y los textos después, sobre el resultado: así
    // una sola escritura deja las dos cosas y un único punto de deshacer.
    const urlsPermitidas = new Set(fotosAdjuntas.map((f) => f.url));
    const resFotos = colocarFotos(bloques, fotos, urlsPermitidas);
    const {
      bloques: nuevos,
      aplicados,
      descartados,
    } = aplicarCambios(resFotos.bloques, cambios);

    if (aplicados.length === 0 && resFotos.colocadas.length === 0) {
      console.warn("[chat-web] todos descartados:", descartados, resFotos.descartadas);
      const motivo = resFotos.descartadas[0]?.motivo;
      return {
        ok: true,
        data: {
          respuesta:
            motivo ??
            "No he podido hacer ese cambio. Dime con otras palabras qué quieres cambiar.",
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

    const detalle = [
      ...resFotos.colocadas.map((f) => `Foto puesta en ${f.etiqueta}`),
      ...aplicados.map((c) => `Cambiado el ${etiquetaCampo(c.campo)}`),
      ...resFotos.descartadas.map((d) => `Sin colocar: ${d.motivo}`),
    ];
    return {
      ok: true,
      data: {
        respuesta,
        aplicados: aplicados.length + resFotos.colocadas.length,
        detalle,
        hayDeshacer: true,
      },
    };
  } catch (err) {
    console.error("[chat-web][enviar] fatal:", err);
    return { ok: false, error: friendlyError(err, "respuesta") };
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
    return { ok: false, error: friendlyError(err, "previos") };
  }
}
