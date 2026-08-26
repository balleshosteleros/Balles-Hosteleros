"use server";

import { createClient } from "@/lib/supabase/server";
import { geminiTexto } from "@/lib/ia/gemini";

/**
 * Reescribe el borrador de un mensaje del chat interno antes de enviarlo.
 *
 * Dos reglas de negocio, no de estilo:
 *
 * 1. SIEMPRE formal. Es un chat de trabajo entre compañeros de la empresa: el
 *    resultado se redacta en tono profesional por defecto, sin que haya que
 *    pedirlo.
 *
 * 2. NUNCA escribe desde el enfado. Es lo que más daño hace en un chat de
 *    trabajo: alguien caliente escribe algo que no se puede retirar. La IA
 *    conserva el HECHO y la petición, y retira el reproche, el insulto, el
 *    sarcasmo y las mayúsculas de grito. No suaviza el contenido — un problema
 *    grave se sigue diciendo — solo le quita la carga personal.
 *
 * Nunca inventa datos: si el borrador no dice una fecha, la reescritura tampoco.
 */

const SISTEMA = `Eres un asistente que reescribe mensajes para el chat interno de una empresa de hostelería. Devuelves ÚNICAMENTE el mensaje reescrito, sin comillas, sin saludos añadidos, sin explicaciones y sin opciones alternativas.

REGLAS OBLIGATORIAS:

1. TONO FORMAL Y PROFESIONAL, siempre. Trata de "tú" (es entre compañeros), pero con registro correcto de trabajo. Nada de jerga, ni emojis, ni exclamaciones múltiples.

2. NUNCA REDACTES DESDE LA EMOCIÓN. Si el borrador viene con enfado, reproche, sarcasmo, insulto, amenaza o mayúsculas de grito:
   - CONSERVA el hecho objetivo y lo que se pide.
   - ELIMINA el ataque personal, la culpa ("otra vez tú", "no haces nada"), el sarcasmo y el dramatismo.
   - Reformúlalo como un hecho + una petición concreta.
   - No suavices la gravedad del asunto: si algo es un problema serio, se dice con claridad, pero sin cargar contra la persona.

3. NO INVENTES INFORMACIÓN. No añadas fechas, horas, nombres, cifras ni compromisos que no estén en el borrador original. Tampoco AFINES ni concretes lo que el borrador deja genérico: si dice "la cámara", escribe "la cámara" — nunca "la cámara frigorífica". Si dice "el pedido", no lo conviertas en "el pedido de bebidas". Ante la duda, quédate con la palabra exacta del borrador.

4. MISMO IDIOMA que el borrador (normalmente español).

5. BREVE. Un mensaje de chat, no un correo. Sin firma ni despedida.

Ejemplo:
Borrador: "otra vez la camara de la cocina sin cerrar!! es que no aprendeis, llevo diciendolo TODA la semana"
Reescrito: "He vuelto a encontrar la cámara de la cocina sin cerrar. Ya lo he comentado varias veces esta semana, así que os pido que reviséis el cierre al terminar el turno."`;

export async function mejorarTextoMensaje(borrador: string): Promise<{
  ok: boolean;
  texto?: string;
  error?: string;
}> {
  try {
    // Solo usuarios autenticados: la IA es un recurso de pago de la empresa.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "No autenticado" };

    const limpio = borrador.trim();
    if (!limpio) return { ok: false, error: "Escribe primero el mensaje" };
    if (limpio.length > 2000) {
      return { ok: false, error: "El mensaje es demasiado largo para mejorarlo" };
    }

    const salida = await geminiTexto(
      [
        { role: "system", content: SISTEMA },
        { role: "user", content: limpio },
      ],
      // Temperatura baja: queremos una reescritura fiel, no creatividad.
      { temperature: 0.2 },
    );

    const texto = (salida ?? "").trim().replace(/^["“”']|["“”']$/g, "");
    if (!texto) {
      return { ok: false, error: "La IA no está disponible ahora mismo" };
    }
    return { ok: true, texto };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] mejorarTextoMensaje:", msg);
    return { ok: false, error: "No se ha podido mejorar el mensaje" };
  }
}
