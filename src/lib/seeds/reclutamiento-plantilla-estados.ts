/**
 * Seed canónico de la PLANTILLA DE ESTADOS por defecto del pipeline de
 * RECLUTAMIENTO. Es la "consecución de estados" que ya seguían todas las
 * vacantes: 3 fases (Selección · Formación · Descartado) y 10 estados.
 *
 * Se propaga a todas las empresas (presentes y futuras) de forma ADITIVA vía
 * `syncSeedsToAllEmpresas()` / `seedEmpresaDefaults()`: solo se crea si la
 * empresa todavía no tiene ninguna plantilla de estados (no pisa al cliente).
 *
 * La estructura de cada estado coincide con `ESTADOS_CONFIG` y `FASES_PRINCIPALES`
 * de `src/features/rrhh/data/reclutamiento.ts`.
 */

export type FasePlantillaEstado =
  | "seleccion"
  | "onboarding"
  | "offboarding"
  | "descartado";

export interface PlantillaEstadoItemSeed {
  /** Clave estable del estado (= EstadoReclutamiento). */
  key: string;
  /** Nombre visible de la columna. */
  label: string;
  /** Color HSL del estado. */
  color: string;
  /** Fase principal a la que pertenece. */
  fase: FasePlantillaEstado;
  /** Orden dentro del pipeline. */
  orden: number;
  /**
   * Nombre de la plantilla de EMAIL (biblioteca suelta) que se asocia por
   * defecto a este estado. El sync lo resuelve a `email_plantilla_id` por
   * empresa. Si no hay coincidencia, el estado queda sin email por defecto.
   */
  defaultEmailNombre?: string;
}

export interface PlantillaEstadoSeed {
  nombre: string;
  esPredeterminada: boolean;
  estados: PlantillaEstadoItemSeed[];
}

export const RECLUTAMIENTO_PLANTILLA_ESTADOS_SEED: PlantillaEstadoSeed = {
  nombre: "Proceso de selección estándar",
  esPredeterminada: true,
  estados: [
    // ── Fase Selección (todos heredan el color oficial de la fase) ──
    { key: "nuevo", label: "Nuevo", color: "hsl(220, 70%, 55%)", fase: "seleccion", orden: 1, defaultEmailNombre: "Nuevo" },
    { key: "elegido", label: "Elegido", color: "hsl(220, 70%, 55%)", fase: "seleccion", orden: 2, defaultEmailNombre: "Elegido" },
    { key: "entrevista", label: "Entrevista", color: "hsl(220, 70%, 55%)", fase: "seleccion", orden: 3, defaultEmailNombre: "Entrevista" },
    { key: "documentacion", label: "Documentación", color: "hsl(220, 70%, 55%)", fase: "seleccion", orden: 4, defaultEmailNombre: "Documentación" },
    // ── Onboarding: 1 fase con 4 sub-columnas (Formación · Contratación · Prueba · Empleado) ──
    { key: "formacion", label: "Formación", color: "hsl(145, 63%, 42%)", fase: "onboarding", orden: 5, defaultEmailNombre: "Formación" },
    { key: "contratacion", label: "Contratación", color: "hsl(38, 92%, 50%)", fase: "onboarding", orden: 6, defaultEmailNombre: "Contratación" },
    // Nota: `formacion` y `contratacion` disparan además correos del sistema por
    // clave (ver CLAVES_RESERVADAS_POR_ESTADO). El email por defecto de aquí es el
    // correo genérico que recibe el candidato al entrar en la fase.
    { key: "prueba", label: "Prueba", color: "hsl(265, 60%, 55%)", fase: "onboarding", orden: 7, defaultEmailNombre: "Prueba" },
    { key: "empleado", label: "Empleado", color: "hsl(145, 63%, 42%)", fase: "onboarding", orden: 8, defaultEmailNombre: "Empleado" },
    // ── Offboarding: 1 fase con 4 sub-columnas (Preaviso · Baja contrato · Entregas · Finiquito) ──
    { key: "preaviso", label: "Preaviso", color: "hsl(25, 85%, 52%)", fase: "offboarding", orden: 9, defaultEmailNombre: "Preaviso" },
    { key: "baja_contrato", label: "Baja contrato", color: "hsl(25, 85%, 52%)", fase: "offboarding", orden: 10, defaultEmailNombre: "Baja contrato" },
    { key: "entregas", label: "Entregas", color: "hsl(25, 85%, 52%)", fase: "offboarding", orden: 11, defaultEmailNombre: "Entregas" },
    { key: "finiquito", label: "Finiquito", color: "hsl(25, 85%, 52%)", fase: "offboarding", orden: 12, defaultEmailNombre: "Finiquito" },
    // ── Fase Descartado (todos heredan el color oficial de la fase) ──
    { key: "papelera", label: "Papelera", color: "hsl(0, 72%, 51%)", fase: "descartado", orden: 13, defaultEmailNombre: "Papelera" },
    { key: "no_se_presenta", label: "No se presenta", color: "hsl(0, 72%, 51%)", fase: "descartado", orden: 14, defaultEmailNombre: "No se presenta" },
    { key: "suspenso_formacion", label: "Suspenso Formación", color: "hsl(0, 72%, 51%)", fase: "descartado", orden: 15, defaultEmailNombre: "Suspenso Formación" },
    { key: "ex_empleado", label: "Ex-empleados", color: "hsl(0, 72%, 51%)", fase: "descartado", orden: 16, defaultEmailNombre: "Ex-empleados" },
  ],
};

// Incluye las fases legacy (formacion/contratacion/prueba/empleado) mapeadas a
// «Onboarding», por si una plantilla de estados guardada en BD las usa todavía.
export const FASES_PLANTILLA_ESTADO: Record<string, { label: string; color: string }> = {
  seleccion: { label: "Selección", color: "hsl(220, 70%, 55%)" },
  onboarding: { label: "Onboarding", color: "hsl(145, 63%, 42%)" },
  offboarding: { label: "Offboarding", color: "hsl(25, 85%, 52%)" },
  descartado: { label: "Descartado", color: "hsl(0, 72%, 51%)" },
  // legacy
  formacion: { label: "Onboarding", color: "hsl(145, 63%, 42%)" },
  contratacion: { label: "Onboarding", color: "hsl(145, 63%, 42%)" },
  prueba: { label: "Onboarding", color: "hsl(145, 63%, 42%)" },
  empleado: { label: "Onboarding", color: "hsl(145, 63%, 42%)" },
};
