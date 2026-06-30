/**
 * Contrato imperativo de las secciones de configuración de Reclutamiento.
 *
 * Cuando van `embedded` dentro de ReglasSubmodulosPanel, las secciones ocultan
 * su propio botón «Guardar» y exponen este handle para que el panel pueda
 * guardarlas todas con un único botón.
 */
export interface ConfigSectionHandle {
  /** Persiste los cambios pendientes. Devuelve true si todo fue bien. */
  guardar: () => Promise<boolean>;
  /** True si hay cambios sin guardar. */
  hayCambios: () => boolean;
}
