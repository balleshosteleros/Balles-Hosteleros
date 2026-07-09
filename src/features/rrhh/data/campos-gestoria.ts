/**
 * Catálogo de campos del alta de contrato que se envían a la gestoría. Módulo de
 * datos puro (sin "use server") para poder importarse desde componentes cliente
 * y desde server actions.
 *
 * TODOS los campos son OBLIGATORIOS: la gestoría necesita el alta completa. No
 * hay checklist configurable — si algún dato falta, el proceso NO envía el correo
 * (se bloquea aguas arriba, en la contratación, con un mensaje de qué falta). Ver
 * `validarDatosAltaGestoria`.
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

// ─────────────────────────────────────────────────────────────────────────
// Validación de integridad de los datos que van a la gestoría.
//
// El usuario ha decidido que TODOS los datos son obligatorios y que NO debe
// existir ninguna vía por la que el correo salga con datos faltantes ("—" o
// un salario 0 falso). Estas funciones detectan qué campos faltan para poder
// BLOQUEAR el proceso aguas arriba con un mensaje claro.
// ─────────────────────────────────────────────────────────────────────────

/** ¿Está vacío un dato de texto? (null, undefined o solo espacios). */
function vacio(v: unknown): boolean {
  return v == null || (typeof v === "string" && v.trim() === "");
}

/** Datos mínimos del ALTA que deben existir para poder enviar a la gestoría. */
export interface DatosAltaGestoria {
  nombre?: string | null;
  dni_nie?: string | null;
  telefono?: string | null;
  email?: string | null;
  puesto?: string | null;
  primer_dia?: string | null;
  tipo_contrato?: string | null;
  jornada?: string | null;
  horas_semanales?: number | string | null;
  /** Salario neto mensual. Un 0 NO es válido (default falso de la plantilla). */
  salario_neto?: number | null;
  convenio?: string | null;
}

/**
 * Devuelve las ETIQUETAS de los campos que faltan para un alta completa. Vacío =
 * todos los datos presentes. El salario debe ser > 0 (un 0 es el default falso
 * de una plantilla sin configurar, no un alta válida).
 */
export function faltantesAltaGestoria(d: DatosAltaGestoria): string[] {
  const faltan: string[] = [];
  if (vacio(d.nombre)) faltan.push("Nombre y apellidos");
  if (vacio(d.dni_nie)) faltan.push("DNI / NIE");
  if (vacio(d.telefono)) faltan.push("Teléfono");
  if (vacio(d.email)) faltan.push("Email");
  if (vacio(d.puesto)) faltan.push("Puesto");
  if (vacio(d.primer_dia)) faltan.push("Primer día");
  if (vacio(d.tipo_contrato)) faltan.push("Tipo de contrato");
  if (vacio(d.jornada)) faltan.push("Jornada");
  if (d.horas_semanales == null || Number(d.horas_semanales) <= 0) faltan.push("Horas/semana");
  if (d.salario_neto == null || Number(d.salario_neto) <= 0) faltan.push("Salario neto");
  if (vacio(d.convenio)) faltan.push("Convenio colectivo");
  return faltan;
}

/** Datos mínimos de la BAJA que deben existir para poder enviar a la gestoría. */
export interface DatosBajaGestoria {
  ultimo_dia_iso?: string | null;
  nombre?: string | null;
  dni_nie?: string | null;
  telefono?: string | null;
  email?: string | null;
  puesto?: string | null;
  tipo_contrato?: string | null;
  convenio?: string | null;
}

/** Formato de fecha de calendario ISO (YYYY-MM-DD). */
const ISO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Devuelve las ETIQUETAS de los campos que faltan para una baja completa. Vacío =
 * todos los datos presentes. La baja se BLOQUEA si falta cualquiera (decisión del
 * usuario), para que la gestoría no reciba una baja con datos identificativos en
 * blanco.
 */
export function faltantesBajaGestoria(d: DatosBajaGestoria): string[] {
  const faltan: string[] = [];
  if (vacio(d.ultimo_dia_iso) || !ISO_FECHA.test(String(d.ultimo_dia_iso))) {
    faltan.push("Último día de trabajo");
  }
  if (vacio(d.nombre)) faltan.push("Nombre y apellidos");
  if (vacio(d.dni_nie)) faltan.push("DNI / NIE");
  if (vacio(d.telefono)) faltan.push("Teléfono");
  if (vacio(d.email)) faltan.push("Email");
  if (vacio(d.puesto)) faltan.push("Puesto");
  if (vacio(d.tipo_contrato)) faltan.push("Tipo de contrato");
  if (vacio(d.convenio)) faltan.push("Convenio colectivo");
  return faltan;
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
