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

export type FasePlantillaEstado = "seleccion" | "formacion" | "descartado";

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
    // ── Fase Formación (todos heredan el color oficial de la fase) ──
    { key: "teorica", label: "Teórica", color: "hsl(145, 63%, 42%)", fase: "formacion", orden: 5, defaultEmailNombre: "Teórica" },
    { key: "practica", label: "Práctica", color: "hsl(145, 63%, 42%)", fase: "formacion", orden: 6, defaultEmailNombre: "Práctica" },
    { key: "prueba", label: "Prueba", color: "hsl(145, 63%, 42%)", fase: "formacion", orden: 7, defaultEmailNombre: "Prueba" },
    { key: "empleado", label: "Empleado", color: "hsl(145, 63%, 42%)", fase: "formacion", orden: 8, defaultEmailNombre: "Empleado" },
    // ── Fase Descartado (todos heredan el color oficial de la fase) ──
    { key: "papelera", label: "Papelera", color: "hsl(0, 72%, 51%)", fase: "descartado", orden: 9, defaultEmailNombre: "Papelera" },
    { key: "no_se_presenta", label: "No se presenta", color: "hsl(0, 72%, 51%)", fase: "descartado", orden: 10, defaultEmailNombre: "No se presenta" },
    { key: "suspenso_formacion", label: "Suspenso Formación", color: "hsl(0, 72%, 51%)", fase: "descartado", orden: 11, defaultEmailNombre: "Suspenso Formación" },
  ],
};

export const FASES_PLANTILLA_ESTADO: Record<FasePlantillaEstado, { label: string; color: string }> = {
  seleccion: { label: "Selección", color: "hsl(220, 70%, 55%)" },
  formacion: { label: "Formación", color: "hsl(145, 63%, 42%)" },
  descartado: { label: "Descartado", color: "hsl(0, 72%, 51%)" },
};
