"use server";

/**
 * Importación rápida de imagen de marca a partir de la URL del cliente.
 *
 * Flujo:
 *   1. Fetch HTML del sitio
 *   2. Encuentra candidatos a imagen (og:image, twitter:image, apple-touch-icon, link icon, /favicon.ico)
 *   3. Para cada candidato resuelve dimensiones y los clasifica en LOGOTIPO (wide, aspect>=1.4)
 *      o ISOTIPO (square, aspect~1)
 *   4. Detecta familia tipográfica (Google Fonts en <link>, o font-family en CSS inline)
 *   5. Pide a Gemini Vision que extraiga la paleta a partir del LOGOTIPO (o isotipo si no hay)
 *   6. Devuelve preview para que Imagen de Marca lo aplique
 */

import { geminiJSON } from "@/lib/ia/gemini";

const HEX = /^#[0-9a-fA-F]{6}$/;

interface ImagenDetectada {
  dataUrl: string;
  mimeType: string;
  base64: string;
  aspectRatio: number; // width / height
  bytes: number;
}

export interface MarcaImportada {
  paleta: { primario: string; secundario: string; texto: string };
  logotipo: { dataUrl: string; mimeType: string } | null;
  isotipo: { dataUrl: string; mimeType: string } | null;
  tipografia: { titulos: string | null; cuerpo: string | null };
  nombreSugerido: string | null;
  fuenteUrl: string;
}

export type ImportarMarcaResult =
  | { ok: true; data: MarcaImportada }
  | { ok: false; error: string };

// ─── Helpers ────────────────────────────────────────────────────────────

function toAbsUrl(href: string, baseUrl: URL): string {
  try {
    return new URL(href, baseUrl.toString()).toString();
  } catch {
    return "";
  }
}

async function descargarImagen(src: string): Promise<ImagenDetectada | null> {
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") ?? "image/png")
      .split(";")[0]
      .trim();
    if (!ct.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200 || buf.length > 5 * 1024 * 1024) return null;
    const dims = leerDimensiones(buf, ct);
    const aspect = dims ? dims.w / dims.h : 1;
    const base64 = buf.toString("base64");
    return {
      dataUrl: `data:${ct};base64,${base64}`,
      mimeType: ct,
      base64,
      aspectRatio: aspect,
      bytes: buf.length,
    };
  } catch {
    return null;
  }
}

/**
 * Lee dimensiones de PNG/JPEG/GIF/SVG/WebP sin dependencias externas.
 * Devuelve null si el formato no se reconoce (asumimos aspect 1).
 */
function leerDimensiones(
  buf: Buffer,
  mime: string,
): { w: number; h: number } | null {
  // PNG: signature 89 50 4E 47, IHDR at offset 16, width=8 bytes (uint32 BE), height=12 bytes
  if (
    buf.length >= 24 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  // GIF: width 6-7 (LE), height 8-9
  if (
    buf.length >= 10 &&
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46
  ) {
    return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  }
  // JPEG: parse SOF markers
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      // SOF0..SOF15 (excluyendo DHT 0xC4, DAC 0xCC, DRI 0xCB)
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      ) {
        const h = buf.readUInt16BE(i + 5);
        const w = buf.readUInt16BE(i + 7);
        return { w, h };
      }
      const len = buf.readUInt16BE(i + 2);
      i += 2 + len;
    }
  }
  // SVG: regex sobre los primeros 4 KB
  if (mime === "image/svg+xml") {
    const head = buf.subarray(0, Math.min(buf.length, 4096)).toString("utf8");
    const viewBox = head.match(/viewBox=["']\s*([-\d.]+)\s+([-\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
    if (viewBox) {
      const w = parseFloat(viewBox[3]);
      const h = parseFloat(viewBox[4]);
      if (w > 0 && h > 0) return { w, h };
    }
    const widthAttr = head.match(/<svg[^>]+width=["']([\d.]+)/i);
    const heightAttr = head.match(/<svg[^>]+height=["']([\d.]+)/i);
    if (widthAttr && heightAttr) {
      return { w: parseFloat(widthAttr[1]), h: parseFloat(heightAttr[1]) };
    }
  }
  // WebP: VP8 / VP8L / VP8X
  if (
    buf.length >= 30 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    if (buf[12] === 0x56 && buf[13] === 0x50 && buf[14] === 0x38) {
      if (buf[15] === 0x20) {
        // Lossy VP8
        return {
          w: buf.readUInt16LE(26) & 0x3fff,
          h: buf.readUInt16LE(28) & 0x3fff,
        };
      }
      if (buf[15] === 0x4c) {
        // Lossless VP8L
        const b0 = buf[21];
        const b1 = buf[22];
        const b2 = buf[23];
        const b3 = buf[24];
        return {
          w: ((b1 & 0x3f) << 8) + b0 + 1,
          h: ((b3 & 0xf) << 10) + (b2 << 2) + ((b1 & 0xc0) >> 6) + 1,
        };
      }
      if (buf[15] === 0x58) {
        // Extended VP8X
        const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
        const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
        return { w, h };
      }
    }
  }
  return null;
}

function detectarTipografia(html: string): {
  titulos: string | null;
  cuerpo: string | null;
} {
  // 1) Google Fonts URL
  const googleFonts = [
    ...html.matchAll(
      /https?:\/\/fonts\.googleapis\.com\/css2?\?family=([^"'&\s]+)/gi,
    ),
  ];
  const familias: string[] = [];
  for (const m of googleFonts) {
    const fam = decodeURIComponent(m[1])
      .split("&family=")
      .map((f) => f.split(":")[0].replace(/\+/g, " ").trim())
      .filter(Boolean);
    familias.push(...fam);
  }

  // 2) font-family declaraciones en <style> inline
  const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
  for (const sb of styleBlocks) {
    const css = sb[1];
    const decl = [...css.matchAll(/font-family\s*:\s*([^;}\n]+)/gi)];
    for (const d of decl) {
      const lista = d[1]
        .split(",")
        .map((s) => s.trim().replace(/["']/g, ""))
        .filter(
          (s) =>
            !!s &&
            !["inherit", "initial", "unset", "revert", "sans-serif", "serif", "monospace", "system-ui"].includes(s),
        );
      if (lista[0]) familias.push(lista[0]);
    }
  }

  if (familias.length === 0) return { titulos: null, cuerpo: null };
  const dedup = Array.from(new Set(familias));
  return {
    titulos: dedup[0] ?? null,
    cuerpo: dedup[1] ?? dedup[0] ?? null,
  };
}

// ─── Acción principal ───────────────────────────────────────────────────

export async function importarMarcaConIA(input: {
  urlWeb: string;
}): Promise<ImportarMarcaResult> {
  let url = input.urlWeb.trim();
  if (!url) return { ok: false, error: "Introduce una URL" };
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  let html: string;
  let baseUrl: URL;
  try {
    baseUrl = new URL(url);
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BallesBrandImporter/1.0; +https://balleshosteleros.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return { ok: false, error: `La web devolvió ${res.status}` };
    }
    html = await res.text();
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `No se pudo acceder a ${url}: ${err.message}`
          : "No se pudo acceder a la web",
    };
  }

  // Candidatos
  const ogMatches = [
    ...html.matchAll(
      /<meta[^>]+(?:property|name)=["']og:image(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/gi,
    ),
  ];
  const twitterMatch = html.match(
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  );
  const appleMatches = [
    ...html.matchAll(
      /<link[^>]+rel=["']apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/gi,
    ),
  ];
  const iconMatches = [
    ...html.matchAll(
      /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/gi,
    ),
  ];

  const candidatosUrls = new Set<string>();
  for (const m of ogMatches) candidatosUrls.add(toAbsUrl(m[1], baseUrl));
  if (twitterMatch) candidatosUrls.add(toAbsUrl(twitterMatch[1], baseUrl));
  for (const m of appleMatches) candidatosUrls.add(toAbsUrl(m[1], baseUrl));
  for (const m of iconMatches) candidatosUrls.add(toAbsUrl(m[1], baseUrl));
  candidatosUrls.add(toAbsUrl("/favicon.ico", baseUrl));
  candidatosUrls.delete("");

  // Descarga y mide en paralelo (cap 8)
  const candidates = Array.from(candidatosUrls).slice(0, 8);
  const descargas = await Promise.all(
    candidates.map(async (src) => {
      const img = await descargarImagen(src);
      return img ? { src, img } : null;
    }),
  );
  const validas = descargas.filter(
    (x): x is { src: string; img: ImagenDetectada } => x !== null,
  );

  // Clasificar
  let logotipo: ImagenDetectada | null = null;
  let isotipo: ImagenDetectada | null = null;

  // Logotipo = el más ancho (aspect >= 1.4), priorizando el de mayor tamaño en bytes
  const wides = validas
    .filter((v) => v.img.aspectRatio >= 1.4)
    .sort((a, b) => b.img.bytes - a.img.bytes);
  if (wides.length > 0) logotipo = wides[0].img;

  // Isotipo = el más cuadrado (0.7 < aspect < 1.4), priorizando bytes
  const squares = validas
    .filter((v) => v.img.aspectRatio >= 0.7 && v.img.aspectRatio < 1.4)
    .sort((a, b) => b.img.bytes - a.img.bytes);
  if (squares.length > 0) isotipo = squares[0].img;

  // Fallback: si solo hay imágenes y no se clasificaron, usar la más grande como logotipo
  if (!logotipo && !isotipo && validas.length > 0) {
    const ordenadas = [...validas].sort((a, b) => b.img.bytes - a.img.bytes);
    if (ordenadas[0].img.aspectRatio >= 1.2) logotipo = ordenadas[0].img;
    else isotipo = ordenadas[0].img;
  }

  // Nombre sugerido
  const ogSite = html.match(
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
  );
  const ogTitle = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  );
  const titleTag = html.match(/<title>([^<]+)<\/title>/i);
  const nombreSugeridoRaw = (
    ogSite?.[1] ??
    ogTitle?.[1] ??
    titleTag?.[1] ??
    ""
  ).trim();
  const nombreSugerido = nombreSugeridoRaw
    ? nombreSugeridoRaw.replace(/\s+/g, " ").slice(0, 80)
    : null;

  // Tipografía
  const tipografia = detectarTipografia(html);

  // Gemini Vision sobre la mejor imagen para extraer paleta
  const mejor = logotipo ?? isotipo;
  const paleta = await pedirPaletaIA(mejor);

  return {
    ok: true,
    data: {
      paleta,
      logotipo: logotipo
        ? { dataUrl: logotipo.dataUrl, mimeType: logotipo.mimeType }
        : null,
      isotipo: isotipo
        ? { dataUrl: isotipo.dataUrl, mimeType: isotipo.mimeType }
        : null,
      tipografia,
      nombreSugerido,
      fuenteUrl: url,
    },
  };
}

async function pedirPaletaIA(
  imagen: ImagenDetectada | null,
): Promise<{ primario: string; secundario: string; texto: string }> {
  const fallback = {
    primario: "#1F2937",
    secundario: "#94A3B8",
    texto: "#FFFFFF",
  };
  if (!imagen) return fallback;

  try {
    const result = await geminiJSON<{
      primario: string;
      secundario: string;
      texto: string;
    }>(
      [
        "Analiza este logotipo y extrae la paleta de marca principal.",
        "",
        "Devuelve 3 colores en formato hexadecimal #RRGGBB:",
        "- primario: el color dominante del logo.",
        "- secundario: un color complementario (acento, contorno). Si solo hay un color, devuelve una versión más oscura/clara del primario para que CONTRASTE con él, NUNCA blanco o casi blanco.",
        "- texto: #FFFFFF si el primario es oscuro, #111111 si el primario es claro.",
        "",
        "Devuelve SOLO los 3 hex. Sin texto adicional.",
      ].join("\n"),
      {
        responseSchema: {
          type: "object",
          properties: {
            primario: { type: "string", description: "Hex #RRGGBB" },
            secundario: { type: "string", description: "Hex #RRGGBB" },
            texto: { type: "string", description: "Hex #RRGGBB" },
          },
          required: ["primario", "secundario", "texto"],
        } as Parameters<typeof geminiJSON>[1]["responseSchema"],
        attachments: [{ mimeType: imagen.mimeType, base64: imagen.base64 }],
        temperature: 0.2,
      },
    );
    const out = { ...fallback };
    if (HEX.test(result.data.primario)) out.primario = result.data.primario.toUpperCase();
    if (HEX.test(result.data.secundario)) out.secundario = result.data.secundario.toUpperCase();
    if (HEX.test(result.data.texto)) out.texto = result.data.texto.toUpperCase();
    return out;
  } catch (err) {
    console.warn(
      "[marca-import] Gemini falló, devuelvo paleta neutra:",
      err instanceof Error ? err.message : err,
    );
    return fallback;
  }
}
