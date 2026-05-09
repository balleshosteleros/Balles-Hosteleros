import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
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

    const empresaId = await getEmpresaActivaForUser(supabase, user.id);
    if (!empresaId) return NextResponse.json({ error: "Sin empresa" }, { status: 403 });

    // Protección de cuota Gemini — 3 capas configurables por env
    const maxDia = Number(process.env.PRESENTACIONES_MAX_POR_DIA ?? "50");
    const maxUserDia = Number(process.env.PRESENTACIONES_MAX_POR_USUARIO_DIA ?? "5");
    const cooldownSeg = Number(process.env.PRESENTACIONES_COOLDOWN_SEG ?? "30");

    const inicioDia = new Date();
    inicioDia.setUTCHours(0, 0, 0, 0);
    const inicioDiaIso = inicioDia.toISOString();

    const { count: usadasHoyGlobal } = await supabase
      .from("presentaciones")
      .select("id", { count: "exact", head: true })
      .gte("created_at", inicioDiaIso);
    if ((usadasHoyGlobal ?? 0) >= maxDia) {
      return NextResponse.json(
        {
          error:
            "Has alcanzado el uso máximo de la herramienta de IA por hoy. Vuelve a intentarlo mañana.",
        },
        { status: 429 },
      );
    }

    const { count: usadasHoyUser } = await supabase
      .from("presentaciones")
      .select("id", { count: "exact", head: true })
      .eq("created_by", user.id)
      .gte("created_at", inicioDiaIso);
    if ((usadasHoyUser ?? 0) >= maxUserDia) {
      return NextResponse.json(
        {
          error: `Has alcanzado el uso máximo de la herramienta de IA por hoy (${maxUserDia} presentaciones). Vuelve a intentarlo mañana.`,
        },
        { status: 429 },
      );
    }

    const { data: ultima } = await supabase
      .from("presentaciones")
      .select("created_at")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ultima?.created_at) {
      const segDesdeUltima = (Date.now() - new Date(ultima.created_at).getTime()) / 1000;
      if (segDesdeUltima < cooldownSeg) {
        const espera = Math.ceil(cooldownSeg - segDesdeUltima);
        return NextResponse.json(
          {
            error: `Espera ${espera}s antes de generar otra presentación con IA.`,
          },
          { status: 429 },
        );
      }
    }

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
      if (/quota|rate.?limit|429/i.test(msg)) {
        return NextResponse.json(
          {
            error:
              "Has alcanzado el uso máximo de la herramienta de IA por hoy. Vuelve a intentarlo mañana.",
          },
          { status: 429 },
        );
      }
      return NextResponse.json({ error: `IA falló: ${msg}` }, { status: 502 });
    }

    // Persistencia
    const { data: presentacion, error: pErr } = await supabase
      .from("presentaciones")
      .insert({
        empresa_id: empresaId,
        titulo: ia.data.titulo,
        nombre: ia.data.titulo, // Compatibilidad con migración 010
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
