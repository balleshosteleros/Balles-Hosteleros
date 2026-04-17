import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generarPresentacion } from "@/features/direccion/presentaciones/services/ia-presentacion";
import { GeminiKeyMissingError } from "@/lib/ia/gemini";

const InputSchema = z.object({
  prompt: z.string().min(10).max(2000),
  audiencia: z.string().max(300).optional(),
  numSlides: z.number().int().min(3).max(30),
  tono: z.enum(["formal", "cercano", "motivacional", "tecnico"]),
  idioma: z.string().min(2).max(5),
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", user.id)
      .single();
    const empresaId = profile?.empresa_id;
    if (!empresaId) return NextResponse.json({ error: "Sin empresa" }, { status: 403 });

    // Branding snapshot
    const { data: branding } = await supabase
      .from("empresa_branding")
      .select("*")
      .eq("empresa_id", empresaId)
      .maybeSingle();

    // Llama a Gemini
    let ia;
    try {
      ia = await generarPresentacion(input);
    } catch (err) {
      if (err instanceof GeminiKeyMissingError) {
        return NextResponse.json(
          { error: "GEMINI_API_KEY no configurada en servidor" },
          { status: 412 },
        );
      }
      const msg = err instanceof Error ? err.message : "Error IA";
      console.error("[api/generar] Gemini:", msg);
      return NextResponse.json({ error: `IA falló: ${msg}` }, { status: 502 });
    }

    // Persistencia
    const { data: presentacion, error: pErr } = await supabase
      .from("presentaciones")
      .insert({
        empresa_id: empresaId,
        titulo: ia.data.titulo,
        prompt_original: input.prompt,
        audiencia: input.audiencia ?? null,
        tono: input.tono,
        idioma: input.idioma,
        num_slides: ia.data.slides.length,
        estado: "listo",
        modelo_ia: ia.modelo,
        tokens_input: ia.tokensInput,
        tokens_output: ia.tokensOutput,
        branding_snapshot: branding ?? {},
        created_by: user.id,
      })
      .select()
      .single();
    if (pErr) {
      console.error("[api/generar] insert presentacion:", pErr);
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    const rows = ia.data.slides.map((s, idx) => ({
      presentacion_id: presentacion.id,
      orden: idx + 1,
      layout: s.layout,
      titulo: s.titulo,
      contenido: {
        bullets: s.bullets,
        cuerpo: s.cuerpo,
        cita: s.cita,
        comparacion: s.comparacion,
        imagen_prompt: s.imagen_prompt,
      },
      notas: s.notas ?? null,
    }));
    const { error: sErr } = await supabase.from("presentacion_slides").insert(rows);
    if (sErr) {
      console.error("[api/generar] insert slides:", sErr);
      // Rollback presentación para no dejar huérfano
      await supabase.from("presentaciones").delete().eq("id", presentacion.id);
      return NextResponse.json({ error: sErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      id: presentacion.id,
      titulo: presentacion.titulo,
      num_slides: rows.length,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Input inválido", detalles: err.issues }, { status: 400 });
    }
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[api/generar]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const maxDuration = 60;
