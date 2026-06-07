// Configuración general de fichajes por empresa (Ajustes RRHH → Fichajes).
// Módulo de datos puro (sin "use server") para poder exportar constante y tipo,
// que un archivo de server actions no puede exportar.

export interface FichajePolicy {
  permitirAntes: boolean;
  margenAntesMin: number;
  permitirDespues: boolean;
  margenDespuesMin: number;
  redondearAntes: boolean;
  redondearDespues: boolean;
}

export const FICHAJE_POLICY_DEFAULT: FichajePolicy = {
  permitirAntes: true,
  margenAntesMin: 15,
  permitirDespues: true,
  margenDespuesMin: 15,
  redondearAntes: true,
  redondearDespues: false,
};
