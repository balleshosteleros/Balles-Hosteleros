// Configuración general de fichajes por empresa (Ajustes RRHH → Fichajes).
// Módulo de datos puro (sin "use server") para poder exportar constante y tipo,
// que un archivo de server actions no puede exportar.

/** Cuándo salta el aviso (pop-up) de fichar en el móvil. */
export type PopupModo = "ventana" | "siempre";

export interface FichajePolicy {
  permitirAntes: boolean;
  margenAntesMin: number;
  permitirDespues: boolean;
  margenDespuesMin: number;
  redondearAntes: boolean;
  redondearDespues: boolean;
  // Aviso (pop-up) de fichar en el móvil.
  popupModo: PopupModo;
  popupMargenAntesMin: number;
  popupMargenDespuesMin: number;
  popupSinHorario: boolean;
  // Permite fichar fuera de la ventana/sin turno; no auto-paraliza la jornada.
  permitirFueraHorario: boolean;
  // Reavisos del aviso de fichar (modo ventana): repetir cada X min dentro de la
  // cortesía mientras no haya fichado. Entrega por push + sonido/vibración.
  reavisoActivo: boolean;
  reavisoIntervaloMin: number;
  avisoSonido: boolean;
  avisoVibracion: boolean;
  // Auto-fichar salida: cerrar la jornada (horario fijo) a la hora prevista +
  // margen, sin depender de que el empleado fiche salida.
  autoSalidaActiva: boolean;
  autoSalidaMargenMin: number;
  // Multi-empresa: avisar al empleado de que su jornada CONTINÚA en otra empresa
  // al cruzar el límite entre turnos de empresas distintas (en vez del reaviso de
  // "ficha entrada"). Aplica a todos los empleados de la empresa.
  avisoCambioEmpresa: boolean;
}

export const FICHAJE_POLICY_DEFAULT: FichajePolicy = {
  permitirAntes: true,
  margenAntesMin: 15,
  permitirDespues: true,
  margenDespuesMin: 15,
  redondearAntes: true,
  redondearDespues: false,
  popupModo: "ventana",
  popupMargenAntesMin: 15,
  popupMargenDespuesMin: 15,
  popupSinHorario: false,
  permitirFueraHorario: false,
  reavisoActivo: false,
  reavisoIntervaloMin: 5,
  avisoSonido: false,
  avisoVibracion: false,
  autoSalidaActiva: false,
  autoSalidaMargenMin: 15,
  avisoCambioEmpresa: false,
};
