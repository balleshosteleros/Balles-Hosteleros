/**
 * Cliente Gemini — Google AI Studio (tier free).
 *
 * Uso: llamadas server-side únicamente. Lee GEMINI_API_KEY.
 * Usa structured output (responseSchema) para garantizar JSON válido.
 */
import { GoogleGenerativeAI, type Schema } from "@google/generative-ai";
import { comprobarPresupuesto, registrarConsumo } from "@/lib/ia/presupuesto";
import { avisarGastoIa } from "@/lib/ia/aviso-gasto";

const DEFAULT_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

/**
 * Modelo para REDACCIÓN (correos, textos que lee una persona).
 *
 * Va aparte del `DEFAULT_MODEL` a propósito. El modelo por defecto es un
 * `flash-lite`: barato y rápido, perfecto para el grueso del software, que es
 * EXTRAER datos de documentos (facturas, nóminas, modelos AEAT) — ahí la
 * respuesta es un JSON de campos y el matiz literario da igual.
 *
 * Redactar es otra tarea. `flash-lite` hilvana las frases sin entender la
 * relación entre ellas: en un aviso de avería resumía "el técnico confirmó que
 * estaba arreglada, pero el error persiste" y se le perdía lo importante — que
 * vino y NO lo arregló. Se notaba al lado del "Pulir" de Gmail, que usa un
 * modelo grande.
 *
 * Se eligió `gemini-3.7-flash` tras comparar salidas reales: capta esos matices
 * y responde en ~3 s. El `pro` razona algo mejor, pero tarda ~13 s, demasiado
 * para un botón que se pulsa y se espera mirando la pantalla.
 */
export const MODELO_REDACCION =
  process.env.GEMINI_MODEL_REDACCION?.trim() || "gemini-3.7-flash";

/**
 * Modelo para leer DOCUMENTOS que llegan como foto o PDF (albaranes, nóminas).
 *
 * Aquí no basta con "extraer datos": hay que leer una imagen —a menudo una foto
 * de móvil, torcida o del revés— Y ceñirse a un esquema JSON largo. `flash-lite`
 * falla en lo segundo: en 8 pasadas sobre albaranes reales devolvió la
 * estructura correcta solo 4 veces; las otras 4 se inventó las claves
 * (`{cabecera, lineas}` en vez del esquema pedido) y la importación se caía con
 * "El modelo no devolvió un JSON válido". Eso son 15 de 69 importaciones
 * perdidas en producción (22%), que había que volver a subir a mano.
 *
 * `gemini-3.7-flash` acertó 8 de 8 en la misma prueba. Tarda ~9 s en lugar de
 * ~6 s, irrelevante en un proceso que ya es de fondo y que el usuario no espera
 * mirando la pantalla.
 *
 * Ojo: leer los IMPORTES se les da parecido a los dos (ambos clavaron total,
 * base, IVA y las 8 líneas de una factura fotografiada boca abajo). Lo que
 * cambia es la FIABILIDAD del formato de salida, que es lo que rompía.
 */
export const MODELO_DOCUMENTOS =
  process.env.GEMINI_MODEL_DOCUMENTOS?.trim() || "gemini-3.7-flash";

export class GeminiKeyMissingError extends Error {
  constructor() {
    super("GEMINI_API_KEY no configurada en variables de entorno");
    this.name = "GeminiKeyMissingError";
  }
}

/**
 * Cuota de la API agotada (429). En el tier free el límite es POR DÍA (p.ej. 20
 * peticiones/día por modelo), así que reintentar en segundos no sirve de nada.
 * El mensaje está pensado para enseñarse tal cual al usuario final.
 */
export class GeminiQuotaError extends Error {
  constructor() {
    super(
      "La IA que lee los documentos ha alcanzado su límite diario de uso. " +
        "Vuelve a intentarlo mañana por la mañana o avisa al administrador para ampliar el plan.",
    );
    this.name = "GeminiQuotaError";
  }
}

/** ¿El fallo del SDK es un 429 de cuota o rate-limit? */
function esErrorDeCuota(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b429\b|Too Many Requests|quota|resource.?exhausted/i.test(msg);
}

export interface GeminiInlineAttachment {
  /** Tipo MIME (e.g. "image/jpeg", "application/pdf"). */
  mimeType: string;
  /** Contenido del archivo en base64 (sin prefijo data:). */
  base64: string;
}

export interface GeminiJSONOptions {
  model?: string;
  systemInstruction?: string;
  responseSchema: Schema;
  temperature?: number;
  /** Adjuntos multimodales (imágenes, PDFs). Gemini los lee de forma nativa. */
  attachments?: GeminiInlineAttachment[];
  /**
   * Tope de tokens de salida. Sin tope, una generación degenerada (el modelo
   * repitiéndose en bucle) corre hasta el máximo del modelo (~2,5 min) antes de
   * devolver un JSON truncado. Ponerlo acota ese caso; dimensiónalo muy por
   * encima de la respuesta legítima más grande esperada.
   */
  maxOutputTokens?: number;
  /**
   * Quién está gastando ("correo.pulir", "albaranes.ocr"...). Se guarda en
   * `ia_uso_log` para poder ver en qué se va el presupuesto de IA.
   */
  feature?: string;
}

export interface GeminiJSONResult<T> {
  data: T;
  tokensInput: number | null;
  tokensOutput: number | null;
  modelo: string;
}

export async function geminiJSON<T = unknown>(
  prompt: string,
  opts: GeminiJSONOptions,
): Promise<GeminiJSONResult<T>> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new GeminiKeyMissingError();

  // Freno de gasto: si el mes ya agotó el tope, ni se llama a Google. Lanza
  // PresupuestoIaAgotadoError, que el caller enseña como un fallo genérico.
  const presupuesto = await comprobarPresupuesto();
  if (presupuesto.enAviso) {
    // Sin await: avisar no debe retrasar la respuesta al usuario.
    void avisarGastoIa("aviso", presupuesto.gastado, presupuesto.tope);
  }

  const modelo = opts.model || DEFAULT_MODEL;
  const genAI = new GoogleGenerativeAI(key);
  const crearModelo = (id: string) =>
    genAI.getGenerativeModel({
      model: id,
      systemInstruction: opts.systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: opts.responseSchema,
        temperature: opts.temperature ?? 0.5,
        ...(opts.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}),
      },
    });

  const hasAttachments = opts.attachments && opts.attachments.length > 0;
  const request = hasAttachments
    ? {
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              ...opts.attachments!.map((a) => ({
                inlineData: { mimeType: a.mimeType, data: a.base64 },
              })),
            ],
          },
        ],
      }
    : prompt;

  // A veces (sobre todo con imágenes) el modelo entra en bucle y devuelve un JSON
  // truncado o vacío pese al responseSchema. Es transitorio: el mismo input suele
  // salir bien al reintentar. Escalera: 2 intentos con el modelo primario y, si
  // ambos fallan, 1 intento con un modelo más potente de respaldo (Pro sufre mucho
  // menos ese bucle). El respaldo solo se paga cuando el primario falla dos veces.
  const respaldo = process.env.GEMINI_MODEL_FALLBACK?.trim() || "gemini-2.5-pro";
  const escalera = [modelo, modelo];
  if (respaldo && respaldo !== modelo) escalera.push(respaldo);

  for (let intento = 1; intento <= escalera.length; intento++) {
    const modeloIntento = escalera[intento - 1];
    let result;
    try {
      result = await crearModelo(modeloIntento).generateContent(request);
    } catch (err) {
      // El volcado crudo del SDK (URL, JSON de violations…) no debe llegar al usuario.
      if (esErrorDeCuota(err)) throw new GeminiQuotaError();
      // Error de red/API transitorio: si quedan peldaños en la escalera, seguir.
      if (intento < escalera.length) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[gemini] fallo de llamada (intento ${intento}/${escalera.length}, modelo=${modeloIntento}):`, msg);
        continue;
      }
      throw err;
    }
    const text = result.response.text();

    try {
      const data = JSON.parse(text) as T;
      const usage = result.response.usageMetadata;
      // Se apunta lo gastado ANTES de devolver, para que la siguiente llamada
      // ya cuente con ello. Sin await: no retrasa la respuesta.
      void registrarConsumo({
        feature: opts.feature ?? "sin_identificar",
        modelo: modeloIntento,
        tokensEntrada: usage?.promptTokenCount ?? null,
        tokensSalida: usage?.candidatesTokenCount ?? null,
      });

      return {
        data,
        tokensInput: usage?.promptTokenCount ?? null,
        tokensOutput: usage?.candidatesTokenCount ?? null,
        modelo: modeloIntento,
      };
    } catch {
      const finishReason = result.response.candidates?.[0]?.finishReason ?? "desconocido";
      // Solo el inicio: un output degenerado puede ocupar cientos de KB.
      console.error(
        `[gemini] JSON inválido (intento ${intento}/${escalera.length}, modelo=${modeloIntento}, finishReason=${finishReason}, ${text.length} chars). Inicio:`,
        text.slice(0, 300),
      );
    }
  }

  // Mensaje pensado para enseñarse tal cual al usuario final.
  throw new Error(
    "La IA no consiguió leer el documento esta vez. Suele resolverse reintentando en unos segundos.",
  );
}

/**
 * Respuesta en TEXTO libre (sin esquema JSON). Para chats conversacionales.
 *
 * Devuelve null si no hay key o si la llamada falla, para que el caller pueda
 * caer a su propio fallback sin romper la pantalla.
 */
export async function geminiTexto(
  mensajes: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  opts: { temperature?: number; model?: string } = {},
): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;

  try {
    const sistema = mensajes
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");

    const conversacion = mensajes.filter((m) => m.role !== "system");

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: opts.model || DEFAULT_MODEL,
      systemInstruction: sistema || undefined,
      generationConfig: { temperature: opts.temperature ?? 0.3 },
    });

    const result = await model.generateContent({
      contents: conversacion.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    });

    return result.response.text() || null;
  } catch (err) {
    console.error("[gemini][texto]", err);
    return null;
  }
}
