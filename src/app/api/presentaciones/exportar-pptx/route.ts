import { NextResponse } from "next/server";
import { z } from "zod";
import pptxgen from "pptxgenjs";
import { createClient } from "@/lib/supabase/server";
import type { Branding, Slide } from "@/features/direccion/presentaciones/types/presentaciones";

const InputSchema = z.object({ id: z.string().uuid() });

const DEFAULT_BRAND = {
  color_primario: "#0F172A",
  color_secundario: "#3B82F6",
  color_fondo: "#FFFFFF",
  color_texto: "#0F172A",
  tipografia_titulo: "Inter",
  tipografia_cuerpo: "Inter",
  logo_url: null as string | null,
};

/** Convierte '#RRGGBB' → 'RRGGBB' (formato pptxgenjs) */
function hex(c: string): string {
  return (c ?? "#000000").replace(/^#/, "").toUpperCase();
}

async function urlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") ?? "image/png";
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id } = InputSchema.parse(body);

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { data: pres, error: pErr } = await supabase
      .from("presentaciones")
      .select("*")
      .eq("id", id)
      .single();
    if (pErr || !pres) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const { data: slides, error: sErr } = await supabase
      .from("presentacion_slides")
      .select("*")
      .eq("presentacion_id", id)
      .order("orden");
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

    const brand = { ...DEFAULT_BRAND, ...(pres.branding_snapshot as Partial<Branding>) };
    const logoBase64 = brand.logo_url ? await urlToBase64(brand.logo_url) : null;

    const pptx = new pptxgen();
    pptx.layout = "LAYOUT_WIDE";
    pptx.title = pres.titulo;

    for (const s of (slides ?? []) as Slide[]) {
      const slide = pptx.addSlide();
      slide.background = { color: hex(brand.color_fondo) };

      // Logo
      if (logoBase64) {
        slide.addImage({
          data: logoBase64,
          x: 11.5, y: 0.25, w: 1.2, h: 0.6,
          sizing: { type: "contain", w: 1.2, h: 0.6 },
        });
      }

      const titleOpts = {
        x: 0.6,
        y: 0.5,
        w: 11,
        h: 1.1,
        fontFace: brand.tipografia_titulo,
        fontSize: 32,
        color: hex(brand.color_primario),
        bold: true,
      } as const;

      switch (s.layout) {
        case "portada": {
          slide.addText(s.titulo ?? "", {
            ...titleOpts,
            y: 2.6, h: 1.6, fontSize: 48, w: 11.8,
          });
          if (s.contenido?.cuerpo) {
            slide.addText(s.contenido.cuerpo, {
              x: 0.6, y: 4.4, w: 11.8, h: 1.2,
              fontFace: brand.tipografia_cuerpo, fontSize: 20,
              color: hex(brand.color_texto),
            });
          }
          break;
        }
        case "cita": {
          slide.addText(`"${s.contenido?.cita ?? s.titulo ?? ""}"`, {
            x: 1, y: 2.4, w: 11.3, h: 2.5,
            fontFace: brand.tipografia_titulo, fontSize: 32, italic: true,
            align: "center", color: hex(brand.color_texto),
          });
          if (s.titulo && s.contenido?.cita) {
            slide.addText(`— ${s.titulo}`, {
              x: 1, y: 5.2, w: 11.3, h: 0.6,
              fontFace: brand.tipografia_cuerpo, fontSize: 16,
              align: "center", color: hex(brand.color_secundario),
            });
          }
          break;
        }
        case "comparacion": {
          slide.addText(s.titulo ?? "", titleOpts);
          const izq = s.contenido?.comparacion?.izquierda ?? [];
          const der = s.contenido?.comparacion?.derecha ?? [];
          const tIzq = s.contenido?.comparacion?.tituloIzq;
          const tDer = s.contenido?.comparacion?.tituloDer;
          if (tIzq) {
            slide.addText(tIzq, {
              x: 0.6, y: 1.9, w: 5.8, h: 0.5,
              fontSize: 20, bold: true, color: hex(brand.color_primario),
            });
          }
          if (tDer) {
            slide.addText(tDer, {
              x: 6.8, y: 1.9, w: 5.8, h: 0.5,
              fontSize: 20, bold: true, color: hex(brand.color_secundario),
            });
          }
          slide.addText(izq.map((t) => ({ text: t, options: { bullet: true } })), {
            x: 0.6, y: 2.5, w: 5.8, h: 4.5,
            fontFace: brand.tipografia_cuerpo, fontSize: 16,
            color: hex(brand.color_texto),
          });
          slide.addText(der.map((t) => ({ text: t, options: { bullet: true } })), {
            x: 6.8, y: 2.5, w: 5.8, h: 4.5,
            fontFace: brand.tipografia_cuerpo, fontSize: 16,
            color: hex(brand.color_texto),
          });
          break;
        }
        case "cierre": {
          slide.addText(s.titulo ?? "Gracias", {
            ...titleOpts,
            y: 2.8, h: 1.6, fontSize: 52, align: "center",
          });
          if (s.contenido?.cuerpo) {
            slide.addText(s.contenido.cuerpo, {
              x: 0.6, y: 4.6, w: 11.8, h: 1,
              fontFace: brand.tipografia_cuerpo, fontSize: 20, align: "center",
              color: hex(brand.color_texto),
            });
          }
          break;
        }
        case "imagen": {
          slide.addText(s.titulo ?? "", titleOpts);
          slide.addText(`[imagen: ${s.contenido?.imagen_prompt ?? "sin descripción"}]`, {
            x: 1, y: 2.2, w: 11, h: 4,
            fontFace: brand.tipografia_cuerpo, fontSize: 14,
            color: hex(brand.color_secundario), italic: true,
            align: "center", valign: "middle",
            line: { color: hex(brand.color_secundario), width: 1, dashType: "dash" },
          });
          break;
        }
        case "bullets":
        default: {
          slide.addText(s.titulo ?? "", titleOpts);
          const bullets = s.contenido?.bullets ?? [];
          if (bullets.length) {
            slide.addText(
              bullets.map((b) => ({ text: b, options: { bullet: { code: "2022" } } })),
              {
                x: 0.8, y: 2.0, w: 11.4, h: 4.8,
                fontFace: brand.tipografia_cuerpo, fontSize: 20,
                color: hex(brand.color_texto), paraSpaceAfter: 6,
              },
            );
          } else if (s.contenido?.cuerpo) {
            slide.addText(s.contenido.cuerpo, {
              x: 0.8, y: 2.0, w: 11.4, h: 4.8,
              fontFace: brand.tipografia_cuerpo, fontSize: 18,
              color: hex(brand.color_texto),
            });
          }
          break;
        }
      }

      // Barra inferior color primario
      slide.addShape("rect" as never, {
        x: 0, y: 7.4, w: 13.33, h: 0.1,
        fill: { color: hex(brand.color_primario) },
        line: { color: hex(brand.color_primario), width: 0 },
      });

      if (s.notas) slide.addNotes(s.notas);
    }

    const blob = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
    const filename = `${pres.titulo.replace(/[^\w\s-]/g, "").trim() || "presentacion"}.pptx`;

    return new NextResponse(new Uint8Array(blob), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Input inválido" }, { status: 400 });
    }
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[exportar-pptx]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const maxDuration = 60;
