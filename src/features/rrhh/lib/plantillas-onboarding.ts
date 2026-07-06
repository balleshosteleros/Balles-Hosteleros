/**
 * Constantes PURAS (cliente + servidor) de las plantillas de email del flujo de
 * ONBOARDING (gestoría, contratos, prueba). Sin `server-only`: se pueden importar
 * desde componentes de cliente (Kanban, Plantillas de email) y desde el servidor.
 *
 * El flujo localiza estas plantillas por su CLAVE estable (`clave`), NO por su
 * nombre: así el nombre es libremente editable y se propaga solo. El nombre de
 * abajo es solo el rótulo inicial con el que se siembran.
 */

/** Claves ESTABLES de las plantillas del onboarding (ancla del flujo, inmutable). */
export const CLAVES_ONBOARDING = {
  gestoriaAlta: "gestoria_alta",
  gestoriaRecordatorio: "gestoria_recordatorio",
  contratoInterno: "contrato_interno",
  contratoOficial: "contrato_oficial",
  pruebaAviso: "prueba_aviso",
} as const;

export type ClaveOnboarding =
  (typeof CLAVES_ONBOARDING)[keyof typeof CLAVES_ONBOARDING];

/** Nombre INICIAL (rótulo) de cada plantilla del onboarding (editable después). */
export const NOMBRES_ONBOARDING: Record<ClaveOnboarding, string> = {
  gestoria_alta: "Gestoría · alta de contrato",
  gestoria_recordatorio: "Gestoría · recordatorio de contrato",
  contrato_interno: "Contrato interno (a firmar)",
  contrato_oficial: "Contrato oficial (a firmar)",
  prueba_aviso: "Aviso de periodo de prueba (RRHH)",
};

/**
 * Alias compatible: mantiene la API `PLANTILLAS_ONBOARDING.gestoriaAlta` pero
 * ahora devuelve la CLAVE estable (no el nombre). El resolver busca por clave.
 */
export const PLANTILLAS_ONBOARDING = CLAVES_ONBOARDING;

/** Claves de plantillas del sistema: no se pueden borrar (las dispara el flujo). */
export const CLAVES_ONBOARDING_PROTEGIDAS: ReadonlySet<string> = new Set(
  Object.values(CLAVES_ONBOARDING),
);

/** Destinatario de un correo. */
export type DestinoPlantilla = "candidato" | "gestoria" | "rrhh" | "personalizado";

const DESTINOS_VALIDOS: ReadonlySet<string> = new Set([
  "candidato",
  "gestoria",
  "rrhh",
  "personalizado",
]);

/** Normaliza un valor libre de BD a un destino válido (fallback: candidato). */
export function normalizarDestino(v: unknown): DestinoPlantilla {
  return typeof v === "string" && DESTINOS_VALIDOS.has(v)
    ? (v as DestinoPlantilla)
    : "candidato";
}

/** Etiqueta legible del destinatario (para badges y vista previa). */
export function etiquetaDestino(destino: DestinoPlantilla): string {
  switch (destino) {
    case "gestoria":
      return "Gestoría";
    case "rrhh":
      return "RRHH";
    case "personalizado":
      return "Personalizado";
    default:
      return "Candidato";
  }
}

/** Opciones del selector de destinatario en el editor de plantillas. */
export const OPCIONES_DESTINO: { value: DestinoPlantilla; label: string; ayuda: string }[] = [
  { value: "candidato", label: "Candidato", ayuda: "Al candidato registrado (su email)." },
  { value: "gestoria", label: "Gestoría", ayuda: "Al correo de gestoría de Ajustes de la empresa." },
  { value: "rrhh", label: "RRHH", ayuda: "Al correo de RRHH de Ajustes de la empresa." },
  { value: "personalizado", label: "Personalizado", ayuda: "A una dirección que tú escribas." },
];

/**
 * Destino POR DEFECTO de las plantillas del sistema al sembrarlas. El usuario
 * puede cambiarlo después desde el editor.
 */
export const DESTINO_DEFAULT_POR_CLAVE: Record<ClaveOnboarding, DestinoPlantilla> = {
  gestoria_alta: "gestoria",
  gestoria_recordatorio: "gestoria",
  contrato_interno: "candidato",
  contrato_oficial: "candidato",
  prueba_aviso: "rrhh",
};

/**
 * Plantillas reservadas que dispara el SISTEMA en una fase concreta del
 * onboarding (no se asocian a estados editables). Se suman a las plantillas de
 * estado al pintar los iconos del pipeline. Se identifican por CLAVE.
 *
 *  · contratacion → alta a la gestoría + recordatorio a la gestoría + contrato
 *                   interno + contrato oficial.
 *  · prueba       → aviso periódico a RRHH (cron).
 */
export const CLAVES_RESERVADAS_POR_ESTADO: Record<string, ClaveOnboarding[]> = {
  contratacion: [
    CLAVES_ONBOARDING.gestoriaAlta,
    CLAVES_ONBOARDING.gestoriaRecordatorio,
    CLAVES_ONBOARDING.contratoInterno,
    CLAVES_ONBOARDING.contratoOficial,
  ],
  prueba: [CLAVES_ONBOARDING.pruebaAviso],
};
