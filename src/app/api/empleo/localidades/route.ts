/**
 * Autocompletado de localidades para el formulario público de empleo.
 *
 * Proxy ligero sobre Nominatim (OpenStreetMap): búsqueda mundial de municipios,
 * pueblos y barrios, sin clave de API. Se hace en servidor para fijar el
 * User-Agent que exige la política de uso de Nominatim y evitar CORS desde el
 * navegador. Devuelve como mucho 6 sugerencias en formato { label }.
 *
 * Best-effort: si Nominatim falla o no hay resultados, devuelve lista vacía y el
 * candidato siempre puede escribir su localidad a mano (texto libre).
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface NominatimItem {
  display_name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    suburb?: string;
    neighbourhood?: string;
    state?: string;
    province?: string;
    country?: string;
  };
}

/** Construye una etiqueta corta y legible: "Localidad, Provincia, País". */
function etiqueta(item: NominatimItem): string {
  const a = item.address ?? {};
  const localidad =
    a.city || a.town || a.village || a.municipality || a.suburb || a.neighbourhood || "";
  const region = a.province || a.state || "";
  const partes = [localidad, region, a.country].filter(Boolean);
  if (partes.length > 0) return partes.join(", ");
  // Fallback: recorta el display_name a las primeras 3 partes.
  return (item.display_name ?? "").split(",").slice(0, 3).map((s) => s.trim()).join(", ");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 3) return NextResponse.json({ localidades: [] });

  try {
    const params = new URLSearchParams({
      q,
      format: "jsonv2",
      addressdetails: "1",
      limit: "6",
      "accept-language": "es",
      featureType: "settlement",
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        "User-Agent": "BallesHosteleros/1.0 (empleo)",
        Accept: "application/json",
      },
      // No reintenta: si tarda, el usuario escribe a mano.
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return NextResponse.json({ localidades: [] });
    const data = (await res.json()) as NominatimItem[];

    // Deduplica por etiqueta y limpia vacíos.
    const vistas = new Set<string>();
    const localidades: string[] = [];
    for (const item of Array.isArray(data) ? data : []) {
      const label = etiqueta(item);
      if (label && !vistas.has(label)) {
        vistas.add(label);
        localidades.push(label);
      }
    }
    return NextResponse.json({ localidades });
  } catch {
    return NextResponse.json({ localidades: [] });
  }
}
