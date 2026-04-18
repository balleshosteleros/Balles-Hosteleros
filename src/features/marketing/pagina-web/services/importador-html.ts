/**
 * Importador de HTML público → bloques iniciales.
 * Heurística simple: headings → hero, imágenes grandes → galería, testimonios por keywords.
 * El resultado queda en estado BORRADOR para revisión manual.
 */
import { parse, type HTMLElement } from "node-html-parser";
import type { Bloque } from "../types";

function uuid(): string {
  return crypto.randomUUID();
}

function texto(el: HTMLElement | null): string {
  return (el?.text ?? "").replace(/\s+/g, " ").trim();
}

function absUrl(url: string, base: string): string {
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

export interface ResultadoImportador {
  ok: true;
  bloques: Bloque[];
  stats: {
    heroDetectado: boolean;
    imagenesEncontradas: number;
    testimoniosDetectados: number;
    parrafos: number;
  };
}

export function importarDesdeHtml(html: string, baseUrl: string): ResultadoImportador {
  const root = parse(html);
  const bloques: Bloque[] = [];
  let orden = 0;

  // 1. HERO: <h1> + subtítulo + primer <img> grande
  const h1 = root.querySelector("h1");
  const tituloHero = texto(h1) || tituloDesdeOg(root) || "Bienvenidos";
  const subtitulo =
    texto(root.querySelector("h2")) ||
    texto(root.querySelector("p.hero, .hero p, .subtitle")) ||
    descripcionDesdeOg(root);
  const firstImgHero = buscarImagenHero(root, baseUrl);
  bloques.push({
    id: uuid(),
    tipo: "hero",
    orden: orden++,
    visible: true,
    datos: {
      titulo: tituloHero,
      subtitulo: subtitulo || undefined,
      foto_url: firstImgHero ?? undefined,
      overlay: 0.4,
      cta: { label: "Reservar", href: "#reservas" },
    },
  });

  // 2. PÁRRAFOS principales → texto_libre (primeros 2 largos)
  const parrafos = root
    .querySelectorAll("p")
    .map((p) => texto(p))
    .filter((t) => t.length > 80);
  if (parrafos.length > 0) {
    const html_seguro = parrafos
      .slice(0, 3)
      .map((t) => `<p>${escapeHtml(t)}</p>`)
      .join("\n");
    bloques.push({
      id: uuid(),
      tipo: "texto_libre",
      orden: orden++,
      visible: true,
      datos: { html_seguro },
    });
  }

  // 3. GALERÍA: imágenes > 300px con src distinto al hero
  const imgs = root
    .querySelectorAll("img")
    .map((img) => ({
      url: absUrl(img.getAttribute("src") ?? img.getAttribute("data-src") ?? "", baseUrl),
      alt: img.getAttribute("alt") ?? "",
      width: parseInt(img.getAttribute("width") ?? "0", 10),
    }))
    .filter(
      (i) =>
        i.url &&
        !i.url.endsWith(".svg") &&
        (!firstImgHero || i.url !== firstImgHero) &&
        (i.width === 0 || i.width >= 300),
    )
    .slice(0, 12);
  if (imgs.length >= 3) {
    bloques.push({
      id: uuid(),
      tipo: "galeria",
      orden: orden++,
      visible: true,
      datos: {
        imagenes: imgs.map((i) => ({ url: i.url, alt: i.alt })),
        layout: "grid",
      },
    });
  }

  // 4. TESTIMONIOS: bloques con clase/text "testimon|review|opinion"
  const testimonios: Array<{ nombre: string; texto: string }> = [];
  root.querySelectorAll('[class*="testimon"], [class*="review"], [class*="opinion"], blockquote').forEach((el) => {
    const t = texto(el);
    if (t.length > 40 && t.length < 500) {
      testimonios.push({ nombre: "Cliente", texto: t });
    }
  });
  if (testimonios.length > 0) {
    bloques.push({
      id: uuid(),
      tipo: "testimonios",
      orden: orden++,
      visible: true,
      datos: {
        items: testimonios.slice(0, 6).map((t) => ({ ...t, estrellas: 5 })),
      },
    });
  }

  // 5. CTA + Footer default
  bloques.push({
    id: uuid(),
    tipo: "cta",
    orden: orden++,
    visible: true,
    datos: {
      titulo: "¿Listo para reservar?",
      texto: "Te esperamos en el restaurante.",
      boton: { label: "Reservar ahora", href: "#reservas", variante: "primary" },
    },
  });

  bloques.push({
    id: uuid(),
    tipo: "footer",
    orden: orden++,
    visible: true,
    datos: {
      columnas: [
        {
          titulo: "Navegación",
          items: [
            { label: "Inicio", href: "#" },
            { label: "Carta", href: "#menu" },
            { label: "Reservas", href: "#reservas" },
          ],
        },
      ],
      redes: extraerRedes(root),
      texto_legal: "© Balles Hosteleros. Todos los derechos reservados.",
    },
  });

  return {
    ok: true,
    bloques,
    stats: {
      heroDetectado: Boolean(h1),
      imagenesEncontradas: imgs.length,
      testimoniosDetectados: testimonios.length,
      parrafos: parrafos.length,
    },
  };
}

function tituloDesdeOg(root: HTMLElement): string | null {
  return root.querySelector('meta[property="og:title"]')?.getAttribute("content") ?? null;
}

function descripcionDesdeOg(root: HTMLElement): string {
  return (
    root.querySelector('meta[property="og:description"]')?.getAttribute("content") ??
    root.querySelector('meta[name="description"]')?.getAttribute("content") ??
    ""
  );
}

function buscarImagenHero(root: HTMLElement, baseUrl: string): string | null {
  const og = root.querySelector('meta[property="og:image"]')?.getAttribute("content");
  if (og) return absUrl(og, baseUrl);
  const img = root.querySelector("header img, .hero img, section:first-of-type img");
  const src = img?.getAttribute("src") ?? img?.getAttribute("data-src");
  return src ? absUrl(src, baseUrl) : null;
}

function extraerRedes(root: HTMLElement): Array<{ red: string; url: string }> {
  const redes: Array<{ red: string; url: string }> = [];
  root.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    const match = href.match(/(instagram|facebook|twitter|x\.com|tiktok|youtube|linkedin)/i);
    if (match && redes.length < 8 && !redes.some((r) => r.url === href)) {
      redes.push({ red: match[1], url: href });
    }
  });
  return redes;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
