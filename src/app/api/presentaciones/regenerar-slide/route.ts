import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { regenerarSlide } from "@/features/direccion/presentaciones/services/ia-presentacion";
import { GeminiKeyMissingError } from "@/lib/ia/gemini";

const InputSchema = z.object({
  presentacionId: z.string().guid(),
  slideId: z.string().guid(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = InputSchema.parse(body);

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    // Cargar presentación + slides (RLS garantiza empresa_id)
    const { data: pres, error: pErr } = await supabase
      .from("presentaciones")
      .select("*")
      .eq("id", input.presentacionId)
      .single();
    if (pErr || !pres) {
      return NextResponse.json({ error: "Presentación no encontrada" }, { status: 404 });
    }

    const { data: slides } = await supabase
      .from("presentacion_slides")
      .select("id, orden, layout, titulo")
      .eq("presentacion_id", input.presentacionId)
      .order("orden");
    const slideActual = (slides ?? []).find((s) => s.id === input.slideId);
    if (!slideActual) {
      return NextResponse.json({ error: "Slide no encontrada" }, { status: 404 });
    }

    try {
      const nueva = await regenerarSlide({
        tituloPresentacion: pres.titulo,
        promptOriginal: pres.prompt_original,
        tono: pres.tono,
        idioma: pres.idioma,
        slideActual: {
          orden: slideActual.orden,
          layout: slideActual.layout,
          titulo: slideActual.titulo,
        },
        contextoSlides: (slides ?? [])
          .filter((s) => s.id !== input.slideId)
          .map((s) => ({ orden: s.orden, titulo: s.titulo })),
      });

      const { error: upErr } = await supabase
        .from("presentacion_slides")
        .update({
          layout: nueva.layout,
          titulo: nueva.titulo,
          contenido: {
            bullets: nueva.bullets,
            cuerpo: nueva.cuerpo,
            cita: nueva.cita,
            comparacion: nueva.comparacion,
            imagen_prompt: nueva.imagen_prompt,
          },
          notas: nueva.notas ?? null,
        })
        .eq("id", input.slideId);
      if (upErr) throw upErr;

      return NextResponse.json({ ok: true, slide: nueva });
    } catch (err) {
      if (err instanceof GeminiKeyMissingError) {
        return NextResponse.json(
          { error: "GEMINI_API_KEY no configurada" },
          { status: 412 },
        );
      }
      const msg = err instanceof Error ? err.message : "Error IA";
      console.error("[api/regenerar-slide]", msg);
      if (/quota|rate.?limit|429/i.test(msg)) {
        return NextResponse.json(
          {
            error:
              "Has alcanzado el uso máximo de la herramienta de IA por hoy. Vuelve a intentarlo mañana.",
          },
          { status: 429 },
        );
      }
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Input inválido", detalles: err.issues }, { status: 400 });
    }
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const maxDuration = 30;
