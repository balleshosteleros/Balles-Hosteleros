/**
 * Catálogo de campos del alta de contrato que se pueden incluir (o no) en el
 * correo a la gestoría. Módulo de datos puro (sin "use server") para poder
 * importarse desde componentes cliente y desde server actions.
 */

export const GESTORIA_CAMPOS = [
  { key: "nombre", label: "Nombre y apellidos" },
  { key: "dni_nie", label: "DNI / NIE" },
  { key: "telefono", label: "Teléfono" },
  { key: "email", label: "Email" },
  { key: "puesto", label: "Puesto y nivel" },
  { key: "primer_dia", label: "Primer día" },
  { key: "tipo_contrato", label: "Tipo de contrato" },
  { key: "jornada", label: "Jornada" },
  { key: "horas_semanales", label: "Horas/semana" },
  { key: "salario_neto", label: "Salario neto" },
  { key: "convenio", label: "Convenio colectivo" },
] as const;

export type GestoriaCampoKey = (typeof GESTORIA_CAMPOS)[number]["key"];
export type GestoriaCamposConfig = Record<GestoriaCampoKey, boolean>;

/** Normaliza el jsonb de BD: null o incompleto → todos los campos activados. */
export function normalizarGestoriaCampos(raw: unknown): GestoriaCamposConfig {
  const out = {} as GestoriaCamposConfig;
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  for (const { key } of GESTORIA_CAMPOS) {
    out[key] = obj ? obj[key] !== false : true; // ausente/true = incluido
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// Tipo de baja de contrato (comunicado a la gestoría)
// ─────────────────────────────────────────────────────────────────────────

/** Tipo de baja de contrato que se comunica a la gestoría. */
export type TipoBajaContrato =
  | "voluntaria"
  | "disciplinaria"
  | "no_superado_periodo_prueba"
  | "fin_contrato"
  | "despido_objetivo"
  | "otras";

/** Etiqueta legible del tipo de baja (para el email y la UI). */
export const ETIQUETA_TIPO_BAJA: Record<TipoBajaContrato, string> = {
  voluntaria: "Baja voluntaria",
  disciplinaria: "Despido disciplinario",
  no_superado_periodo_prueba: "No superación del periodo de prueba",
  fin_contrato: "Fin de contrato",
  despido_objetivo: "Despido objetivo",
  otras: "Otras",
};

/**
 * Tipos de baja que puede elegir la EMPRESA al causar la baja desde la ficha del
 * empleado. Incluye «voluntaria» para el caso de VOLUNTARIA FORZOSA: el
 * trabajador no da señales de vida y la empresa tramita su baja voluntaria en su
 * nombre (lo normal es que la voluntaria la solicite el propio trabajador desde
 * Mi Panel → Solicitudes, pero la empresa puede hacerlo si desaparece).
 * Orden para el selector.
 */
export const TIPOS_BAJA_EMPRESA: TipoBajaContrato[] = [
  "disciplinaria",
  "no_superado_periodo_prueba",
  "fin_contrato",
  "despido_objetivo",
  "voluntaria",
  "otras",
];

/**
 * Etiqueta del tipo de baja EN EL CONTEXTO DE LA EMPRESA. Igual que
 * `ETIQUETA_TIPO_BAJA` salvo la voluntaria, que aquí es «Voluntaria forzosa»
 * (la causa la empresa, no el trabajador). La baja voluntaria que solicita el
 * propio trabajador (Mi Panel) sigue usando `ETIQUETA_TIPO_BAJA` → «Baja
 * voluntaria».
 */
export function etiquetaTipoBajaEmpresa(t: TipoBajaContrato): string {
  return t === "voluntaria" ? "Voluntaria forzosa" : ETIQUETA_TIPO_BAJA[t];
}
