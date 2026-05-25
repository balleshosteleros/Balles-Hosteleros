/**
 * Configuración de fases del pipeline de inspectores.
 * Las fases viven aquí como constantes TS (igual que reclutamiento).
 * NO se siembran en BD: el CHECK CONSTRAINT de inspectores.fase es la única fuente.
 * PRP-040.
 */
import type { InspectorFase, InspectorEstadoActividad } from "./types";

export interface FaseInspectorConfig {
  key: InspectorFase;
  label: string;
  descripcion: string;
  color: string; // tailwind chip
  estadoActividad: InspectorEstadoActividad | null;
  ordenKanban: number;
}

export const FASES_INSPECTOR_CONFIG: Record<InspectorFase, FaseInspectorConfig> = {
  bolsa: {
    key: "bolsa",
    label: "Nuevo",
    descripcion: "Recién inscritos pendientes de evaluación",
    color: "bg-slate-100 text-slate-700 border-slate-200",
    estadoActividad: "futuro",
    ordenKanban: 1,
  },
  entrevista: {
    key: "entrevista",
    label: "Elegido",
    descripcion: "Elegidos para avanzar en el proceso",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    estadoActividad: "futuro",
    ordenKanban: 2,
  },
  prueba: {
    key: "prueba",
    label: "En proceso",
    descripcion: "Colaboración en curso, primeras inspecciones",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    estadoActividad: "futuro",
    ordenKanban: 3,
  },
  activo: {
    key: "activo",
    label: "Inspector",
    descripcion: "Inspector consolidado, colabora regularmente",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    estadoActividad: "activo",
    ordenKanban: 4,
  },
  historico: {
    key: "historico",
    label: "Papelera",
    descripcion: "Descartado tras revisión",
    color: "bg-zinc-100 text-zinc-600 border-zinc-200",
    estadoActividad: "historico",
    ordenKanban: 5,
  },
  descartado: {
    key: "descartado",
    label: "No se presenta",
    descripcion: "No respondió o no se presentó al proceso",
    color: "bg-rose-100 text-rose-700 border-rose-200",
    estadoActividad: null,
    ordenKanban: 6,
  },
};

export const FASES_KANBAN_ORDEN: InspectorFase[] = [
  "bolsa",
  "entrevista",
  "prueba",
  "activo",
  "historico",
  "descartado",
];

// ─── Fases principales (3 grupos agrupados — igual que Reclutamiento) ───
export type FasePrincipalInspector = "seleccion" | "colaboracion" | "descartado";

export interface FasePrincipalInspectorConfig {
  label: string;
  color: string;
  colorFrom: string;
  colorTo: string;
  estados: InspectorFase[];
}

const SELECCION_CONFIG: FasePrincipalInspectorConfig = {
  label: "Selección",
  color: "hsl(220, 70%, 55%)",
  colorFrom: "hsl(220, 80%, 60%)",
  colorTo: "hsl(200, 70%, 50%)",
  estados: ["bolsa", "entrevista"],
};

const COLABORACION_CONFIG: FasePrincipalInspectorConfig = {
  label: "Colaboración",
  color: "hsl(145, 63%, 42%)",
  colorFrom: "hsl(145, 70%, 50%)",
  colorTo: "hsl(145, 55%, 35%)",
  estados: ["prueba", "activo"], // "En proceso", "Inspector"
};

const DESCARTADO_CONFIG: FasePrincipalInspectorConfig = {
  label: "Descartado",
  color: "hsl(0, 72%, 51%)",
  colorFrom: "hsl(0, 80%, 58%)",
  colorTo: "hsl(0, 65%, 42%)",
  estados: ["historico", "descartado"], // "Papelera", "No se presenta"
};

export const FASES_PRINCIPALES_INSPECTOR: Record<FasePrincipalInspector, FasePrincipalInspectorConfig> = {
  seleccion: SELECCION_CONFIG,
  colaboracion: COLABORACION_CONFIG,
  descartado: DESCARTADO_CONFIG,
};

export const FASES_PRINCIPALES_INSPECTOR_ORDER: FasePrincipalInspector[] = [
  "seleccion",
  "colaboracion",
  "descartado",
];

export function getFasePrincipalInspector(fase: InspectorFase): FasePrincipalInspector {
  if (SELECCION_CONFIG.estados.includes(fase)) return "seleccion";
  if (COLABORACION_CONFIG.estados.includes(fase)) return "colaboracion";
  return "descartado";
}

export function estadoActividadParaFase(
  fase: InspectorFase,
): InspectorEstadoActividad {
  const cfg = FASES_INSPECTOR_CONFIG[fase];
  return cfg.estadoActividad ?? "futuro";
}

/**
 * Normaliza un teléfono para comparación (clave natural).
 * - Quita espacios y caracteres no numéricos salvo `+`.
 * - Acepta prefijo `+34` opcional para España.
 */
export function normalizarTelefono(input: string | null | undefined): string {
  if (!input) return "";
  const limpio = input.replace(/[^\d+]/g, "");
  // Quita +34 inicial para comparar igual con/sin prefijo
  return limpio.replace(/^\+?34/, "");
}
