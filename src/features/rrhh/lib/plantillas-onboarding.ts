/**
 * Constantes PURAS (cliente + servidor) de las plantillas de email del flujo de
 * ONBOARDING (gestoría, contratos, prueba). Sin `server-only`: se pueden importar
 * desde componentes de cliente (Kanban, Plantillas de email) y desde el servidor.
 *
 * El resolver de servidor (`services/email-plantillas/resolver.ts`) reexporta
 * `PLANTILLAS_ONBOARDING` desde aquí para no duplicar los nombres reservados.
 */

/** Nombres reservados de las plantillas del onboarding (1 por correo). */
export const PLANTILLAS_ONBOARDING = {
  gestoriaAlta: "Gestoría · alta de contrato",
  gestoriaRecordatorio: "Gestoría · recordatorio de contrato",
  contratoInterno: "Contrato interno (a firmar)",
  contratoOficial: "Contrato oficial (a firmar)",
  pruebaAviso: "Aviso de periodo de prueba (RRHH)",
} as const;

export type PlantillaOnboardingNombre =
  (typeof PLANTILLAS_ONBOARDING)[keyof typeof PLANTILLAS_ONBOARDING];

/**
 * Plantillas reservadas que NUNCA se pueden borrar desde la biblioteca: son
 * imprescindibles para el flujo de onboarding (las dispara el sistema, no se
 * asocian a estados editables). Si se borraran, el flujo usaría su texto por
 * defecto, pero preferimos protegerlas para que el usuario siempre las vea/edite.
 */
export const PLANTILLAS_ONBOARDING_PROTEGIDAS: ReadonlySet<string> = new Set(
  Object.values(PLANTILLAS_ONBOARDING),
);

/** Destinatario real de un correo del pipeline (para el icono informativo). */
export type DestinoPlantilla = "candidato" | "gestoria" | "rrhh";

/**
 * Plantillas que van a la GESTORÍA (no al candidato). Llevan un icono/aviso
 * informativo tanto en el pipeline como en el editor de la plantilla.
 */
export const PLANTILLAS_GESTORIA: ReadonlySet<string> = new Set<string>([
  PLANTILLAS_ONBOARDING.gestoriaAlta,
  PLANTILLAS_ONBOARDING.gestoriaRecordatorio,
]);

/** Plantillas que van a RRHH (avisos internos), no al candidato. */
export const PLANTILLAS_RRHH: ReadonlySet<string> = new Set<string>([
  PLANTILLAS_ONBOARDING.pruebaAviso,
]);

/** Devuelve el destinatario de una plantilla a partir de su nombre. */
export function destinoDePlantilla(nombre: string): DestinoPlantilla {
  if (PLANTILLAS_GESTORIA.has(nombre)) return "gestoria";
  if (PLANTILLAS_RRHH.has(nombre)) return "rrhh";
  return "candidato";
}

/**
 * Plantillas reservadas que dispara el SISTEMA en una fase concreta del
 * onboarding (no se asocian a estados editables vía `defaultEmailNombre`). Se
 * suman a las plantillas de estado al pintar los iconos del pipeline.
 *
 *  · contratacion → alta a la gestoría + contrato interno (al trabajador) +
 *    contrato oficial (lo dispara la gestoría al subir el contrato).
 *  · prueba       → aviso periódico a RRHH (cron).
 */
export const PLANTILLAS_RESERVADAS_POR_ESTADO: Record<string, string[]> = {
  contratacion: [
    PLANTILLAS_ONBOARDING.gestoriaAlta,
    PLANTILLAS_ONBOARDING.contratoInterno,
    PLANTILLAS_ONBOARDING.contratoOficial,
  ],
  prueba: [PLANTILLAS_ONBOARDING.pruebaAviso],
};
