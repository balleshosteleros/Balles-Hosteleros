/**
 * Catálogo de campos del formulario público de candidatura y su configuración
 * por empresa (Reclutamiento → Config → Candidatos).
 *
 * - FIJOS: nombre, apellidos, email, teléfono → siempre activos y obligatorios,
 *   no se pueden desactivar ni volver opcionales (el sistema los necesita:
 *   identidad, dedup y contacto). No viven en la config.
 * - CONFIGURABLES: el resto → cada uno con { activo, obligatorio } editable,
 *   persistido en `reclutamiento_config.campos_formulario` (jsonb).
 */

export type CampoCandidaturaClave =
  | "cv"
  | "carta_presentacion"
  | "genero"
  | "ubicacion"
  | "disponibilidad"
  | "experiencia_previa"
  | "como_nos_conocio";

export interface CampoCandidaturaConfig {
  activo: boolean;
  obligatorio: boolean;
}

export type CamposFormularioConfig = Record<CampoCandidaturaClave, CampoCandidaturaConfig>;

/** Campos fijos (no configurables): siempre activos y obligatorios. */
export const CAMPOS_FIJOS: { clave: string; label: string }[] = [
  { clave: "nombre_apellidos", label: "Nombre y apellidos" },
  { clave: "email", label: "Email" },
  { clave: "telefono", label: "Teléfono" },
];

/** Campos configurables, en el orden en que se muestran en el panel y el form. */
export const CAMPOS_CONFIGURABLES: { clave: CampoCandidaturaClave; label: string }[] = [
  { clave: "cv", label: "CV adjunto" },
  { clave: "carta_presentacion", label: "Carta de presentación" },
  { clave: "genero", label: "Género" },
  { clave: "ubicacion", label: "Ubicación" },
  { clave: "disponibilidad", label: "Disponibilidad" },
  { clave: "experiencia_previa", label: "Experiencia previa" },
  { clave: "como_nos_conocio", label: "¿Por dónde nos has conocido?" },
];

/** Valores por defecto — deben coincidir con el default de la migración. */
export const CAMPOS_FORMULARIO_DEFAULT: CamposFormularioConfig = {
  cv: { activo: true, obligatorio: true },
  carta_presentacion: { activo: true, obligatorio: false },
  genero: { activo: true, obligatorio: true },
  ubicacion: { activo: true, obligatorio: true },
  disponibilidad: { activo: true, obligatorio: true },
  experiencia_previa: { activo: true, obligatorio: true },
  como_nos_conocio: { activo: true, obligatorio: true },
};

/**
 * Normaliza una config (posiblemente parcial o nula, p. ej. de BD) rellenando
 * con los valores por defecto. Garantiza que SIEMPRE haya las 7 claves.
 */
export function normalizarCamposFormulario(raw: unknown): CamposFormularioConfig {
  const base: CamposFormularioConfig = { ...CAMPOS_FORMULARIO_DEFAULT };
  if (raw && typeof raw === "object") {
    for (const { clave } of CAMPOS_CONFIGURABLES) {
      const v = (raw as Record<string, unknown>)[clave];
      if (v && typeof v === "object") {
        const vv = v as { activo?: unknown; obligatorio?: unknown };
        base[clave] = {
          activo: typeof vv.activo === "boolean" ? vv.activo : base[clave].activo,
          obligatorio: typeof vv.obligatorio === "boolean" ? vv.obligatorio : base[clave].obligatorio,
        };
      }
    }
  }
  return base;
}
