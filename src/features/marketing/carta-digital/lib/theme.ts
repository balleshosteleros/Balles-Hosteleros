import type { CSSProperties } from "react";
import type { CartaEmpresaPublica, EstiloCards, ModoCarta } from "../types";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const FALLBACK = {
  primario: "#1F2937",
  secundario: "#94A3B8",
  texto: "#FFFFFF",
  fondo: "#FAF7F2",
  acento: "#D4A574",
  fuenteTitulos: "Cormorant Garamond",
  fuenteCuerpo: "Inter",
  estiloCards: "sombra" as EstiloCards,
  modo: "claro" as ModoCarta,
} as const;

function safeHex(value: string | null | undefined, fallback: string): string {
  return value && HEX_RE.test(value) ? value : fallback;
}

function safeFont(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 60) return fallback;
  return trimmed;
}

export interface CartaTheme {
  primario: string;
  secundario: string;
  texto: string;
  fondo: string;
  acento: string;
  fuenteTitulos: string;
  fuenteCuerpo: string;
  estiloCards: EstiloCards;
  modo: ModoCarta;
  textoPrincipal: string;
  textoSuave: string;
  textoTenue: string;
  borde: string;
  superficie: string;
  superficieEnfasis: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function isOscuro(hex: string): boolean {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
}

export function buildCartaTheme(empresa: CartaEmpresaPublica): CartaTheme {
  const primario = safeHex(empresa.color_primario, FALLBACK.primario);
  const secundario = safeHex(empresa.color_secundario, FALLBACK.secundario);
  const texto = safeHex(empresa.color_texto, FALLBACK.texto);
  const fondoBase = safeHex(empresa.carta_color_fondo, FALLBACK.fondo);
  const acento = safeHex(empresa.carta_color_acento, FALLBACK.acento);
  const fuenteTitulos = safeFont(empresa.carta_fuente_titulos, FALLBACK.fuenteTitulos);
  const fuenteCuerpo = safeFont(empresa.carta_fuente_cuerpo, FALLBACK.fuenteCuerpo);
  const estiloCards = (empresa.carta_estilo_cards ?? FALLBACK.estiloCards) as EstiloCards;
  const modo = (empresa.carta_modo ?? FALLBACK.modo) as ModoCarta;

  const oscuro = modo === "oscuro" || (modo === "auto" && isOscuro(fondoBase));
  const fondo = oscuro ? "#101010" : fondoBase;
  const textoPrincipal = oscuro ? "#F5F1EA" : "#1A1A1A";
  const textoSuave = oscuro ? "#B8B0A4" : "#5A5550";
  const textoTenue = oscuro ? "#7A7568" : "#A09A92";
  const borde = oscuro ? "#2A2622" : "#E8E2D6";
  const superficie = oscuro ? "#1A1614" : "#FFFFFF";
  const superficieEnfasis = oscuro ? "#221E1A" : "#F5F1EA";

  return {
    primario,
    secundario,
    texto,
    fondo,
    acento,
    fuenteTitulos,
    fuenteCuerpo,
    estiloCards,
    modo,
    textoPrincipal,
    textoSuave,
    textoTenue,
    borde,
    superficie,
    superficieEnfasis,
  };
}

/** Convierte un tema en un objeto CSSProperties con custom properties listo para inyectar. */
export function themeToCssVars(theme: CartaTheme): CSSProperties {
  return {
    "--carta-primario": theme.primario,
    "--carta-secundario": theme.secundario,
    "--carta-sobre-marca": theme.texto,
    "--carta-fondo": theme.fondo,
    "--carta-acento": theme.acento,
    "--carta-texto": theme.textoPrincipal,
    "--carta-texto-suave": theme.textoSuave,
    "--carta-texto-tenue": theme.textoTenue,
    "--carta-borde": theme.borde,
    "--carta-superficie": theme.superficie,
    "--carta-superficie-enfasis": theme.superficieEnfasis,
    "--carta-fuente-titulos": `'${theme.fuenteTitulos}', Georgia, serif`,
    "--carta-fuente-cuerpo": `'${theme.fuenteCuerpo}', system-ui, sans-serif`,
    backgroundColor: theme.fondo,
    color: theme.textoPrincipal,
    fontFamily: `'${theme.fuenteCuerpo}', system-ui, sans-serif`,
  } as CSSProperties;
}

/** Slug Google Fonts → URL del stylesheet. Soporta selección múltiple. */
export function googleFontsHref(fonts: string[]): string | null {
  const unique = Array.from(new Set(fonts.filter((f) => f && f.length < 60)));
  if (unique.length === 0) return null;
  const families = unique
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@300;400;500;600;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
