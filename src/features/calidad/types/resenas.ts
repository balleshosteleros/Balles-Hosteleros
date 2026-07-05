export type EstadoResena =
  | "nuevo_comensal"
  | "no_contesta"
  | "excelente"
  | "regular"
  | "malo";

export type OrigenResena =
  | "manual"
  | "qr"
  | "carta"
  | "google"
  | "otro";

export interface Resena {
  id: string;
  empresa_id: string;
  numero_secuencial: number | null;
  nombre_comensal: string;
  telefono: string | null;
  email: string | null;
  comentario: string | null;
  estado: EstadoResena;
  rating: number | null;
  origen: OrigenResena;
  posicion: number;
  creado_por: string | null;
  created_at: string;
  updated_at: string;
  // Ingesta externa (Google / QR / etc.)
  external_id: string | null;
  autor_avatar: string | null;
  autor_url: string | null;
  respuesta_propietario: string | null;
  respondida: boolean;
  fecha_reseña: string | null;
  synced_at: string | null;
  // Flujo IA
  respuesta_borrador_at: string | null;
  respuesta_publicada_at: string | null;
  agente_id: string | null;
}

// ─── Agentes IA ───────────────────────────────────────────────

export type TonoAgente =
  | "sin_tono"
  | "profesional"
  | "gracioso"
  | "empatico"
  | "optimista"
  | "jugueton"
  | "agradecido"
  | "cordial"
  | "conciso"
  | "curioso"
  | "orientado_soluciones";

export type IdiomaAgente =
  | "dinamico"
  | "es"
  | "en"
  | "fr"
  | "it"
  | "pt"
  | "de";

export type TipoResenaConfig =
  | "todas"
  | "5_estrellas"
  | "4_o_mas"
  | "3_o_mas"
  | "3_o_menos"
  | "2_o_menos"
  | "1_estrella"
  | "sin_texto";

export type FuenteConfig = "google" | "manual" | "todas";

export interface AgenteIA {
  id: string;
  empresa_id: string;
  nombre: string;
  instrucciones: string;
  tonos: TonoAgente[];
  idioma: IdiomaAgente;
  tipo_resena: TipoResenaConfig;
  fuente: FuenteConfig;
  pie_pagina: string | null;
  max_dia: number;
  activo: boolean;
  creado_por: string | null;
  created_at: string;
  updated_at: string;
}

export const TONO_OPCIONES: { key: TonoAgente; label: string; emoji: string }[] =
  [
    { key: "sin_tono", label: "Sin tono", emoji: "❌" },
    { key: "profesional", label: "Profesional", emoji: "💼" },
    { key: "gracioso", label: "Gracioso", emoji: "😄" },
    { key: "empatico", label: "Empático", emoji: "🥺" },
    { key: "optimista", label: "Optimista", emoji: "🌟" },
    { key: "jugueton", label: "Juguetón", emoji: "🎈" },
    { key: "agradecido", label: "Agradecido", emoji: "🙏" },
    { key: "cordial", label: "Cordial", emoji: "🙂" },
    { key: "conciso", label: "Conciso", emoji: "✂️" },
    { key: "curioso", label: "Curioso", emoji: "🤔" },
    { key: "orientado_soluciones", label: "Orientado a soluciones", emoji: "🛠️" },
  ];

export const TONO_LABEL: Record<TonoAgente, string> = Object.fromEntries(
  TONO_OPCIONES.map((t) => [t.key, t.label]),
) as Record<TonoAgente, string>;

export const IDIOMA_OPCIONES: { key: IdiomaAgente; label: string }[] = [
  { key: "dinamico", label: "Dinámico (igual que la reseña)" },
  { key: "es", label: "Español" },
  { key: "en", label: "Inglés" },
  { key: "fr", label: "Francés" },
  { key: "it", label: "Italiano" },
  { key: "pt", label: "Portugués" },
  { key: "de", label: "Alemán" },
];

export const IDIOMA_LABEL: Record<IdiomaAgente, string> = Object.fromEntries(
  IDIOMA_OPCIONES.map((i) => [i.key, i.label]),
) as Record<IdiomaAgente, string>;

export const TIPO_RESENA_OPCIONES: {
  key: TipoResenaConfig;
  label: string;
  ratings: number[];
}[] = [
  { key: "todas", label: "Todas", ratings: [1, 2, 3, 4, 5] },
  { key: "5_estrellas", label: "5 estrellas", ratings: [5] },
  { key: "4_o_mas", label: "4 estrellas o más", ratings: [4, 5] },
  { key: "3_o_mas", label: "3 estrellas o más", ratings: [3, 4, 5] },
  { key: "3_o_menos", label: "3 estrellas o menos", ratings: [1, 2, 3] },
  { key: "2_o_menos", label: "2 estrellas o menos", ratings: [1, 2] },
  { key: "1_estrella", label: "1 estrella", ratings: [1] },
  { key: "sin_texto", label: "Sin texto", ratings: [1, 2, 3, 4, 5] },
];

export const TIPO_RESENA_LABEL: Record<TipoResenaConfig, string> =
  Object.fromEntries(
    TIPO_RESENA_OPCIONES.map((t) => [t.key, t.label]),
  ) as Record<TipoResenaConfig, string>;

/**
 * Decide si un agente aplica a una reseña concreta. Si varios agentes
 * matchean, se elige el más específico (menos estrellas cubiertas).
 */
export function agenteAplicaAResena(
  agente: Pick<AgenteIA, "tipo_resena" | "fuente" | "activo">,
  resena: Pick<Resena, "rating" | "comentario" | "origen">,
): boolean {
  if (!agente.activo) return false;
  if (agente.fuente !== "todas" && agente.fuente !== resena.origen)
    return false;

  if (agente.tipo_resena === "sin_texto") {
    return !resena.comentario || resena.comentario.trim().length === 0;
  }
  if (!resena.rating) return agente.tipo_resena === "todas";

  const opt = TIPO_RESENA_OPCIONES.find((o) => o.key === agente.tipo_resena);
  if (!opt) return false;
  return opt.ratings.includes(resena.rating);
}

export interface EstadoConfig {
  key: EstadoResena;
  label: string;
  accent: string;
  badge: string;
}

export const ESTADOS_RESENA: EstadoConfig[] = [
  {
    key: "nuevo_comensal",
    label: "Nuevo comensal",
    accent: "border-t-sky-400",
    badge: "bg-sky-100 text-sky-700",
  },
  {
    key: "no_contesta",
    label: "No contesta",
    accent: "border-t-zinc-400",
    badge: "bg-zinc-100 text-zinc-700",
  },
  {
    key: "excelente",
    label: "Excelente",
    accent: "border-t-emerald-400",
    badge: "bg-emerald-100 text-emerald-700",
  },
  {
    key: "regular",
    label: "Regular",
    accent: "border-t-amber-400",
    badge: "bg-amber-100 text-amber-700",
  },
  {
    key: "malo",
    label: "Malo",
    accent: "border-t-rose-400",
    badge: "bg-rose-100 text-rose-700",
  },
];

export const ESTADOS_RESENA_ORDER: EstadoResena[] = ESTADOS_RESENA.map(
  (e) => e.key,
);

export const ESTADO_LABEL: Record<EstadoResena, string> = Object.fromEntries(
  ESTADOS_RESENA.map((e) => [e.key, e.label]),
) as Record<EstadoResena, string>;

export const ORIGEN_LABEL: Record<OrigenResena, string> = {
  manual: "Manual",
  qr: "QR en mesa",
  carta: "Carta digital",
  google: "Google",
  otro: "Otro",
};
