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

/**
 * Destinatario de un correo. Modelo unificado:
 *  · candidato     → el email de la ficha del candidato.
 *  · departamento  → el correo de un DEPARTAMENTO de la empresa (Ajustes → Empresa
 *                    → «Correos electrónicos»). El departamento concreto se guarda
 *                    en `destino_email` como la CLAVE del departamento (ver
 *                    `DEPARTAMENTOS_CORREO`), no como un email suelto.
 *  · personalizado → una dirección de correo escrita a mano.
 *
 * `gestoria` y `rrhh` son valores HEREDADOS (plantillas ya guardadas). Se siguen
 * aceptando y se resuelven como el departamento equivalente, pero el editor ya no
 * los ofrece: se muestran como «departamento» con la clave correspondiente.
 */
export type DestinoPlantilla =
  | "candidato"
  | "departamento"
  | "personalizado"
  // heredados (retrocompatibilidad con datos existentes):
  | "gestoria"
  | "rrhh";

/**
 * Catálogo de DEPARTAMENTOS que pueden ser destinatarios, con la CLAVE del correo
 * correspondiente en `empresas.datos_generales`. La fuente ÚNICA de estos correos
 * es Ajustes → Empresa → «Correos electrónicos». `clave` es lo que se persiste en
 * `reclutamiento_email_plantillas.destino_email` cuando `destino === "departamento"`.
 */
export const DEPARTAMENTOS_CORREO = [
  { clave: "correoRrhh", label: "Recursos Humanos" },
  { clave: "correoGestoria", label: "Gestoría" },
  { clave: "correoContabilidad", label: "Contabilidad" },
  { clave: "correoLogistica", label: "Logística" },
  { clave: "correoCalidad", label: "Calidad" },
  { clave: "correoGerencia", label: "Gerencia" },
  { clave: "correoDireccion", label: "Dirección" },
  { clave: "correoMarketing", label: "Marketing" },
  { clave: "correoJuridico", label: "Jurídico" },
  { clave: "correoGeneral", label: "General" },
] as const;

export type DepartamentoCorreoClave = (typeof DEPARTAMENTOS_CORREO)[number]["clave"];

/** Etiqueta legible de una clave de correo de departamento. */
export function etiquetaDepartamentoCorreo(clave: string | null | undefined): string {
  return DEPARTAMENTOS_CORREO.find((d) => d.clave === clave)?.label ?? "Departamento";
}

const DESTINOS_VALIDOS: ReadonlySet<string> = new Set([
  "candidato",
  "departamento",
  "personalizado",
  "gestoria",
  "rrhh",
]);

/** Normaliza un valor libre de BD a un destino válido (fallback: candidato). */
export function normalizarDestino(v: unknown): DestinoPlantilla {
  return typeof v === "string" && DESTINOS_VALIDOS.has(v)
    ? (v as DestinoPlantilla)
    : "candidato";
}

/**
 * Mapea un destino heredado (`gestoria`/`rrhh`) a `{ destino: "departamento",
 * clave }`. Para destinos ya modernos lo devuelve tal cual. Centraliza la
 * retrocompatibilidad para que el resto del código razone solo en el modelo nuevo.
 */
export function normalizarDestinoDepartamento(
  destino: DestinoPlantilla,
  destinoEmail: string | null,
): { destino: DestinoPlantilla; destinoEmail: string | null } {
  if (destino === "gestoria") return { destino: "departamento", destinoEmail: "correoGestoria" };
  if (destino === "rrhh") return { destino: "departamento", destinoEmail: "correoRrhh" };
  return { destino, destinoEmail };
}

/** Etiqueta legible del destinatario (para badges y vista previa). */
export function etiquetaDestino(destino: DestinoPlantilla, destinoEmail?: string | null): string {
  switch (destino) {
    case "departamento":
      return etiquetaDepartamentoCorreo(destinoEmail);
    case "gestoria":
      return "Gestoría";
    case "rrhh":
      return "Recursos Humanos";
    case "personalizado":
      return "Personalizado";
    default:
      return "Candidato";
  }
}

/** Opciones del selector de destinatario en el editor de plantillas. */
export const OPCIONES_DESTINO: { value: DestinoPlantilla; label: string; ayuda: string }[] = [
  { value: "candidato", label: "Candidato", ayuda: "Al candidato registrado (el email de su ficha)." },
  { value: "departamento", label: "Departamento", ayuda: "Al correo de un departamento de Ajustes → Empresa." },
  { value: "personalizado", label: "Personalizado", ayuda: "A una dirección que tú escribas." },
];

/**
 * Destino POR DEFECTO de las plantillas del sistema al sembrarlas. El usuario
 * puede cambiarlo después desde el editor. Los correos de departamento se
 * resuelven desde Ajustes → Empresa.
 */
export const DESTINO_DEFAULT_POR_CLAVE: Record<
  ClaveOnboarding,
  { destino: DestinoPlantilla; destinoEmail: string | null }
> = {
  gestoria_alta: { destino: "departamento", destinoEmail: "correoGestoria" },
  gestoria_recordatorio: { destino: "departamento", destinoEmail: "correoGestoria" },
  contrato_interno: { destino: "candidato", destinoEmail: null },
  contrato_oficial: { destino: "candidato", destinoEmail: null },
  prueba_aviso: { destino: "departamento", destinoEmail: "correoRrhh" },
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
