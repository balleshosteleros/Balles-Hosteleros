// Tipos del pipeline Nuevas Recetas (PRP-031)

export type FaseColor =
  | "azul" | "naranja" | "ambar" | "violeta" | "rosa"
  | "verde" | "rojo" | "cian" | "indigo" | "gris";

export type EstadoGeneral = "en_progreso" | "aprobada" | "archivada";

export type PrioridadIngrediente = "principal" | "secundario";

export type ValoracionCata =
  | "pendiente" | "rehacer_entera" | "rehacer_media"
  | "semi_aprobada" | "aprobada";

export type GatekeeperTipo =
  | "texto" | "numero" | "adjunto" | "booleano" | "select" | "ref";

export type TareaPrioridad = "alta" | "media" | "baja";
export type TareaTipo = "manual" | "nueva_receta_fase" | "sistema";

// ──────────────────────────────────────────────────────────────
// Tablas
// ──────────────────────────────────────────────────────────────
export interface Fase {
  id: string;
  empresa_id: string;
  nombre: string;
  color: FaseColor;
  orden: number;
  responsable_departamento: string | null;
  responsable_user_id: string | null;
  plazo_dias: number | null;
  es_sistema: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubEstado {
  id: string;
  fase_id: string;
  nombre: string;
  orden: number;
}

export interface Gatekeeper {
  id: string;
  fase_id: string;
  campo: string;
  label: string;
  tipo: GatekeeperTipo;
  opciones: Record<string, unknown> | null;
  obligatorio: boolean;
  orden: number;
}

export interface Ingrediente {
  id: string;
  receta_id: string;
  producto_id: string | null;
  nombre_libre: string | null;
  cantidad: number | null;
  unidad: string;
  prioridad: PrioridadIngrediente;
  orden: number;
}

export interface Compra {
  id: string;
  receta_id: string;
  proveedor_id: string | null;
  proveedor_nombre_libre: string | null;
  producto_id: string | null;
  producto_nombre_propuesto: string | null;
  cantidad: number | null;
  unidad: string;
  precio_propuesto: number | null;
  fecha_recepcion_prevista: string | null;
  notas: string | null;
}

export interface Cata {
  id: string;
  receta_id: string;
  numero: number;
  fecha: string;
  valoracion: ValoracionCata | null;
  aciertos: string | null;
  mejoras: string | null;
  coste_real: number | null;
  pvp_sugerido: number | null;
  foto_url: string | null;
  escandallo_snapshot: Record<string, unknown> | null;
  director_user_id: string | null;
  director_nombre: string | null;
  created_at: string;
}

export interface HistorialEntry {
  id: string;
  receta_id: string;
  fase_anterior_id: string | null;
  fase_anterior_nombre: string | null;
  fase_nueva_id: string | null;
  fase_nueva_nombre: string | null;
  sub_estado_nuevo_id: string | null;
  usuario_id: string | null;
  usuario_nombre: string | null;
  nota: string | null;
  comunicado: boolean;
  created_at: string;
}

export interface Receta {
  id: string;
  empresa_id: string;
  nombre: string;
  descripcion: string | null;
  destino: "cocina" | "sala" | "ambos";
  fase_id: string | null;
  sub_estado_id: string | null;
  escandallo_id: string | null;
  estado_general: EstadoGeneral;
  fecha_fase_inicio: string | null;
  favorita: boolean;
  motivo_archivado: string | null;
  // Borrador escandallo
  esc_descripcion: string | null;
  esc_elaboracion: string | null;
  esc_alergenos: string[];
  esc_partida: string | null;
  esc_tiempo_preparacion: number | null;
  esc_porciones: number | null;
  esc_pvp_propuesto: number | null;
  esc_coste_estimado: number | null;
  esc_etiquetas_finales: string[];
  propuesto_por: string | null;
  propuesto_por_nombre: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tarea {
  id: string;
  empresa_id: string | null;
  user_id: string | null;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  hecha: boolean;
  prioridad: TareaPrioridad;
  tipo: TareaTipo;
  link_url: string | null;
  ref_tabla: string | null;
  ref_id: string | null;
  created_at: string;
}

// ──────────────────────────────────────────────────────────────
// Inputs
// ──────────────────────────────────────────────────────────────
export interface CrearRecetaInput {
  nombre: string;
  descripcion?: string;
  destino: "cocina" | "sala" | "ambos";
  esc_descripcion?: string;
  esc_elaboracion?: string;
  esc_alergenos?: string[];
  esc_partida?: string;
  esc_tiempo_preparacion?: number;
  esc_porciones?: number;
  esc_pvp_propuesto?: number;
  ingredientes?: Array<{
    producto_id?: string | null;
    nombre_libre?: string | null;
    cantidad?: number | null;
    unidad?: string;
    prioridad: PrioridadIngrediente;
  }>;
}

export interface MoverRecetaInput {
  recetaId: string;
  faseDestinoId: string;
  subEstadoId?: string | null;
  nota?: string;
  comunicar?: boolean;
}

// Resultado estándar de actions
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// Paleta de colores con clases Tailwind
export const COLOR_PALETTE: Record<FaseColor, { from: string; to: string; text: string; bg: string }> = {
  azul:     { from: "#60a5fa", to: "#3b82f6", text: "text-blue-700",    bg: "bg-blue-100" },
  naranja:  { from: "#fb923c", to: "#f97316", text: "text-orange-700",  bg: "bg-orange-100" },
  ambar:    { from: "#fbbf24", to: "#f59e0b", text: "text-amber-700",   bg: "bg-amber-100" },
  violeta:  { from: "#a78bfa", to: "#8b5cf6", text: "text-violet-700",  bg: "bg-violet-100" },
  rosa:     { from: "#f472b6", to: "#ec4899", text: "text-pink-700",    bg: "bg-pink-100" },
  verde:    { from: "#4ade80", to: "#22c55e", text: "text-emerald-700", bg: "bg-emerald-100" },
  rojo:     { from: "#f87171", to: "#ef4444", text: "text-red-700",     bg: "bg-red-100" },
  cian:     { from: "#22d3ee", to: "#06b6d4", text: "text-cyan-700",    bg: "bg-cyan-100" },
  indigo:   { from: "#818cf8", to: "#6366f1", text: "text-indigo-700",  bg: "bg-indigo-100" },
  gris:     { from: "#9ca3af", to: "#6b7280", text: "text-gray-700",    bg: "bg-gray-100" },
};

export const VALORACION_LABELS: Record<ValoracionCata, string> = {
  pendiente:      "Pendiente",
  rehacer_entera: "Rehacer entera",
  rehacer_media:  "Rehacer media",
  semi_aprobada:  "Semi-aprobada",
  aprobada:       "Aprobada",
};

export const ESTADO_GENERAL_LABELS: Record<EstadoGeneral, string> = {
  en_progreso: "En progreso",
  aprobada:    "Aprobada",
  archivada:   "Archivada",
};

// ──────────────────────────────────────────────────────────────
// Calendario CAMBIOS DE CARTA
// ──────────────────────────────────────────────────────────────
export interface CambioCarta {
  id: string;
  empresa_id: string;
  nombre: string;
  fecha_inicio: string;
  fecha_oficial: string;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CambioCartaSemana {
  id: string;
  cambio_carta_id: string;
  fase_id: string | null;
  fase_nombre: string;
  color: FaseColor;
  orden: number;
  fecha_inicio: string;
  fecha_fin: string;
  es_oficial: boolean;
  notas: string | null;
}

export interface CambioCartaConSemanas extends CambioCarta {
  semanas: CambioCartaSemana[];
}
