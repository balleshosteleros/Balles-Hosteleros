// PRP-067 — Onboarding (bootstrap) de empresa nueva.

/** Estado persistido de un paso. "completado" se DERIVA de conteos reales;
 *  solo se persisten señales no derivables (en_progreso/omitido) + completado. */
export type OnboardingEstado = "pendiente" | "en_progreso" | "completado" | "omitido";

/** Definición canónica de un paso del bootstrap (vive en `data/steps.ts`). */
export interface OnboardingStep {
  /** Identificador estable; coincide con `empresa_onboarding_pasos.paso_key`. */
  key: string;
  titulo: string;
  descripcion: string;
  /** Obligatorio para cerrar el onboarding (no omitible). */
  obligatorio: boolean;
  /** Keys de pasos previos requeridos (dependencias del modelo). */
  dependencias: string[];
  /** Nombre del icono lucide para la card. */
  icono: string;
  /** Ruta del submódulo para "Añadir manualmente". */
  rutaGestion: string;
  /** Entidad cuyo conteo deriva el estado "completado" (la usa onboarding-actions). */
  entidad: OnboardingEntidad;
  /** El paso de empleados se hace por volcado masivo, no alta manual una a una. */
  volcadoMasivo?: boolean;
}

/** Entidades cuyos conteos reales determinan si un paso está "completado". */
export type OnboardingEntidad =
  | "locales"
  | "puestos"
  | "empleados"
  | "proveedores"
  | "productos"
  | "imagen_marca"
  | "carta"
  | "calendarios";

/** Estado calculado de un paso (catálogo + derivación + persistencia). */
export interface OnboardingPasoEstado {
  key: string;
  estado: OnboardingEstado;
  /** Conteo real de la entidad asociada (para mostrar "3 cargados"). */
  count: number;
}

/** Resumen global del onboarding de una empresa. */
export interface OnboardingResumen {
  pasos: OnboardingPasoEstado[];
  /** % de avance (sobre el total de pasos). */
  progreso: number;
  /** True cuando todos los obligatorios están completados. */
  obligatoriosCompletos: boolean;
  /** Marca de cierre (empresas.onboarding_completado_at). */
  completadoAt: string | null;
}
