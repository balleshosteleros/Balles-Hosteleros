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
