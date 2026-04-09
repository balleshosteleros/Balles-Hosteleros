import type { RedSocial } from "./marketing";

// ─── Types ──────────────────────────────────────────────────────
export type TipoPublicacionSocial = "reels" | "post" | "historias" | "video" | "shorts";

export interface PublicacionesPorTipo {
  tipo: TipoPublicacionSocial;
  label: string;
  cantidad: number;
}

export interface PublicacionesPorRed {
  red: RedSocial;
  total: number;
  desglose: PublicacionesPorTipo[];
}

export interface SeguidoresRed {
  red: RedSocial;
  cuenta: string;
  ganados: number;
  perdidos: number;
  neto: number;
  totalActual: number;
}

export interface TendenciaMensual {
  mes: string;          // "Abr 2025"
  mesCorto: string;     // "Abr"
  publicaciones: number;
  seguidoresGanados: number;
  seguidoresPerdidos: number;
  seguidoresNeto: number;
  comentarios: number;
}

export interface ComentariosRed {
  red: RedSocial;
  total: number;
}

export interface MarketingAnalytics {
  publicaciones: PublicacionesPorRed[];
  seguidores: SeguidoresRed[];
  tendencia12m: TendenciaMensual[];
  comentarios: ComentariosRed[];
}

// ─── Content type mapping per social network ────────────────────
export const TIPOS_POR_RED: Record<RedSocial, { tipo: TipoPublicacionSocial; label: string }[]> = {
  instagram: [
    { tipo: "reels", label: "Reels" },
    { tipo: "post", label: "Post" },
    { tipo: "historias", label: "Historias" },
  ],
  facebook: [
    { tipo: "post", label: "Post" },
    { tipo: "reels", label: "Reels" },
    { tipo: "historias", label: "Historias" },
  ],
  tiktok: [
    { tipo: "video", label: "Vídeos" },
    { tipo: "reels", label: "Reels" },
  ],
  youtube: [
    { tipo: "video", label: "Vídeos" },
    { tipo: "shorts", label: "Shorts" },
  ],
};

// ─── Mock data generator ────────────────────────────────────────
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function buildMarketingAnalytics(empresaId: string): MarketingAnalytics {
  const seed = empresaId === "habana" ? 42 : 99;
  const rand = seededRandom(seed);
  const scale = empresaId === "habana" ? 1.4 : 1;

  // Publicaciones por red
  const publicaciones: PublicacionesPorRed[] = (["instagram", "facebook", "tiktok", "youtube"] as RedSocial[]).map((red) => {
    const tipos = TIPOS_POR_RED[red];
    const desglose = tipos.map((t) => ({
      tipo: t.tipo,
      label: t.label,
      cantidad: Math.round((rand() * 18 + 4) * scale),
    }));
    return { red, total: desglose.reduce((a, b) => a + b.cantidad, 0), desglose };
  });

  // Seguidores
  const cuentas: Record<RedSocial, string> = {
    instagram: empresaId === "habana" ? "@lahabana_rest" : "@bacanal_club",
    facebook: empresaId === "habana" ? "La Habana Restaurante" : "Bacanal Club",
    tiktok: empresaId === "habana" ? "@lahabana_tk" : "@bacanal_tk",
    youtube: empresaId === "habana" ? "La Habana Canal" : "Bacanal Canal",
  };

  const seguidores: SeguidoresRed[] = (["instagram", "facebook", "tiktok", "youtube"] as RedSocial[]).map((red) => {
    const ganados = Math.round((rand() * 800 + 200) * scale);
    const perdidos = Math.round((rand() * 150 + 30) * scale);
    return {
      red,
      cuenta: cuentas[red],
      ganados,
      perdidos,
      neto: ganados - perdidos,
      totalActual: Math.round((rand() * 8000 + 2000) * scale),
    };
  });

  // Tendencia 12 meses
  const now = new Date();
  const tendencia12m: TendenciaMensual[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mesCorto = MESES[d.getMonth()];
    const mes = `${mesCorto} ${d.getFullYear()}`;
    tendencia12m.push({
      mes,
      mesCorto,
      publicaciones: Math.round((rand() * 30 + 10) * scale),
      seguidoresGanados: Math.round((rand() * 600 + 100) * scale),
      seguidoresPerdidos: Math.round((rand() * 120 + 20) * scale),
      seguidoresNeto: 0,
      comentarios: Math.round((rand() * 300 + 50) * scale),
    });
  }
  tendencia12m.forEach((m) => { m.seguidoresNeto = m.seguidoresGanados - m.seguidoresPerdidos; });

  // Comentarios
  const comentarios: ComentariosRed[] = (["instagram", "facebook", "tiktok", "youtube"] as RedSocial[]).map((red) => ({
    red,
    total: Math.round((rand() * 400 + 80) * scale),
  }));

  return { publicaciones, seguidores, tendencia12m, comentarios };
}
