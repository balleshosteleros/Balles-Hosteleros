/**
 * OG image runtime con next/og (Fluid Compute, Node.js).
 * Lee título de la página publicada y genera 1200x630.
 */
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ paginaId: string }> },
) {
  const { paginaId } = await params;

  let titulo = "Restaurante";
  let subtitulo = "";
  try {
    const supabase = createAnonClient();
    const { data } = await supabase
      .from("paginas_web")
      .select("nombre, seo")
      .eq("id", paginaId)
      .eq("estado", "PUBLICADA")
      .maybeSingle();
    if (data) {
      const row = data as { nombre: string; seo: { title?: string; description?: string } | null };
      titulo = row.seo?.title ?? row.nombre;
      subtitulo = row.seo?.description ?? "";
    }
  } catch {
    // fallthrough con defaults
  }

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0b0b0b 0%, #3a3a3a 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 28, opacity: 0.7, display: "flex", marginBottom: 20 }}>
          Balles Hosteleros
        </div>
        <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05, display: "flex" }}>
          {titulo}
        </div>
        {subtitulo ? (
          <div style={{ fontSize: 36, opacity: 0.85, marginTop: 24, display: "flex" }}>
            {subtitulo.slice(0, 120)}
          </div>
        ) : null}
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
