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
}

export interface PlantillaEstadoSeed {
  nombre: string;
  descripcion: string;
  esPredeterminada: boolean;
  estados: PlantillaEstadoItemSeed[];
}

export const RECLUTAMIENTO_PLANTILLA_ESTADOS_SEED: PlantillaEstadoSeed = {
  nombre: "Proceso de selección estándar",
  descripcion:
    "Consecución de estados por defecto: Selección → Formación, con la fase de Descartado para las bajas.",
  esPredeterminada: true,
  estados: [
    // ── Fase Selección ──
    { key: "nuevo", label: "Nuevo", color: "hsl(220, 70%, 55%)", fase: "seleccion", orden: 1 },
    { key: "elegido", label: "Elegido", color: "hsl(200, 70%, 50%)", fase: "seleccion", orden: 2 },
    { key: "entrevista", label: "Entrevista", color: "hsl(145, 63%, 42%)", fase: "seleccion", orden: 3 },
    // ── Fase Formación ──
    { key: "teorica", label: "Teórica", color: "hsl(270, 60%, 55%)", fase: "formacion", orden: 4 },
    { key: "practica", label: "Práctica", color: "hsl(200, 70%, 50%)", fase: "formacion", orden: 5 },
    { key: "prueba", label: "Prueba", color: "hsl(45, 90%, 50%)", fase: "formacion", orden: 6 },
    { key: "empleado", label: "Empleado", color: "hsl(145, 70%, 35%)", fase: "formacion", orden: 7 },
    // ── Fase Descartado ──
    { key: "papelera", label: "Papelera", color: "hsl(0, 0%, 50%)", fase: "descartado", orden: 8 },
    { key: "no_se_presenta", label: "No se presenta", color: "hsl(0, 0%, 55%)", fase: "descartado", orden: 9 },
    { key: "suspenso_formacion", label: "Suspenso Formación", color: "hsl(0, 72%, 51%)", fase: "descartado", orden: 10 },
  ],
};

export const FASES_PLANTILLA_ESTADO: Record<FasePlantillaEstado, { label: string; color: string }> = {
  seleccion: { label: "Selección", color: "hsl(220, 70%, 55%)" },
  formacion: { label: "Formación", color: "hsl(145, 63%, 42%)" },
  descartado: { label: "Descartado", color: "hsl(0, 72%, 51%)" },
};
