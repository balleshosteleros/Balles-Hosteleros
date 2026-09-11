/**
 * QUÉ LE FALTA A UNA FICHA DE EMPLEADO — fuente única.
 *
 * Lo usan a la vez las TRES piezas de la recogida, y por eso vive aquí solo:
 *
 *   · el guard que tapa la app  (`empleado-status.ts`)
 *   · el asistente que lo pide  (`WizardPrimerAcceso`)
 *   · el parte diario por correo (`/api/cron/documentacion-informe`)
 *
 * Si cada una tuviera su lista, bastaría con que el guard exigiese un dato que
 * el asistente no pide para dejar a esa persona dando vueltas sin poder entrar
 * nunca — que es exactamente lo que le pasó a Ruth González con el fichaje.
 * Regla: **todo lo que aparezca aquí tiene que poder rellenarse en el
 * asistente**. Antes de añadir un campo, mira que tenga su casilla.
 *
 * Solo entra lo que DEPENDE DEL TRABAJADOR. Quedan fuera a propósito:
 *   · las condiciones (salario) — las pone la empresa, ficha a ficha
 *   · el documento de la Seguridad Social — lo genera RRHH del recorte de nómina
 *   · la foto — no se le pide a nadie todavía
 *
 * Módulo PURO: sin Supabase y sin nada de servidor, porque el asistente lo
 * importa desde el navegador.
 */

/** Las columnas de `empleados` que hacen falta para saber qué le falta. */
export interface FichaParaRevisar {
  tipo_documento?: string | null;
  dni_nie?: string | null;
  fecha_nacimiento?: string | null;
  genero?: string | null;
  estado_civil?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  codigo_postal?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
  pais?: string | null;
  numero_ss?: string | null;
  iban?: string | null;
  contacto_emergencia_nombre?: string | null;
  contacto_emergencia_telefono?: string | null;
  contacto_emergencia_relacion?: string | null;
  talla_uniforme?: string | null;
  doc_dni_anverso_path?: string | null;
  doc_dni_reverso_path?: string | null;
  doc_iban_path?: string | null;
}

/** Columnas que hay que pedirle a Supabase para poder llamar a `loQueFalta`. */
export const COLUMNAS_REVISION =
  "tipo_documento, dni_nie, fecha_nacimiento, genero, estado_civil, telefono, " +
  "direccion, codigo_postal, ciudad, provincia, pais, numero_ss, iban, " +
  "contacto_emergencia_nombre, contacto_emergencia_telefono, contacto_emergencia_relacion, " +
  "talla_uniforme, doc_dni_anverso_path, doc_dni_reverso_path, doc_iban_path";

/** Los pasos del asistente, en el orden en que se recorren. */
export type PasoFicha = "identidad" | "domicilio" | "emergencia" | "ropa" | "documentos";

export interface CampoPendiente {
  /** Columna de `empleados`. */
  campo: keyof FichaParaRevisar;
  /** Cómo se llama en el correo y en el aviso: en palabras de la persona. */
  etiqueta: string;
  /** En qué paso del asistente se rellena. */
  paso: PasoFicha;
}

const vacio = (v: unknown): boolean =>
  v === null || v === undefined || String(v).trim() === "";

/**
 * Todo lo que se le exige a una ficha, en el orden en que se pide.
 *
 * El orden importa: el aviso enseña los tres primeros, así que delante va lo
 * que más duele que falte (el documento y la cuenta donde cobra).
 */
const EXIGIDO: CampoPendiente[] = [
  { campo: "dni_nie", etiqueta: "número de DNI o NIE", paso: "documentos" },
  { campo: "doc_dni_anverso_path", etiqueta: "DNI por delante", paso: "documentos" },
  { campo: "doc_dni_reverso_path", etiqueta: "DNI por detrás", paso: "documentos" },
  { campo: "iban", etiqueta: "número de cuenta (IBAN)", paso: "documentos" },
  { campo: "doc_iban_path", etiqueta: "certificado bancario", paso: "documentos" },
  { campo: "fecha_nacimiento", etiqueta: "fecha de nacimiento", paso: "documentos" },
  { campo: "numero_ss", etiqueta: "número de la Seguridad Social", paso: "identidad" },
  { campo: "telefono", etiqueta: "teléfono", paso: "identidad" },
  { campo: "tipo_documento", etiqueta: "tipo de documento", paso: "identidad" },
  { campo: "genero", etiqueta: "género", paso: "identidad" },
  { campo: "estado_civil", etiqueta: "estado civil", paso: "identidad" },
  { campo: "direccion", etiqueta: "dirección", paso: "domicilio" },
  { campo: "codigo_postal", etiqueta: "código postal", paso: "domicilio" },
  { campo: "ciudad", etiqueta: "ciudad", paso: "domicilio" },
  { campo: "provincia", etiqueta: "provincia", paso: "domicilio" },
  { campo: "pais", etiqueta: "país", paso: "domicilio" },
  { campo: "contacto_emergencia_nombre", etiqueta: "contacto de emergencia", paso: "emergencia" },
  { campo: "contacto_emergencia_telefono", etiqueta: "teléfono de emergencia", paso: "emergencia" },
  { campo: "contacto_emergencia_relacion", etiqueta: "parentesco del contacto de emergencia", paso: "emergencia" },
  { campo: "talla_uniforme", etiqueta: "talla de uniforme", paso: "ropa" },
];

/** Qué le falta a esta ficha. Lista vacía = está completa. */
export function loQueFalta(ficha: FichaParaRevisar): CampoPendiente[] {
  return EXIGIDO.filter((c) => vacio(ficha[c.campo]));
}

/** Lo que falta, en una frase: «tu teléfono, tu talla de uniforme y 2 cosas más». */
export function enPalabras(pendientes: CampoPendiente[], maximo = 3): string {
  const nombres = pendientes.map((p) => p.etiqueta);
  if (nombres.length === 0) return "";
  if (nombres.length <= maximo) {
    if (nombres.length === 1) return nombres[0];
    return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
  }
  const resto = nombres.length - maximo;
  return `${nombres.slice(0, maximo).join(", ")} y ${resto} ${resto === 1 ? "cosa más" : "cosas más"}`;
}

/**
 * Qué pasos del asistente hay que enseñarle: SOLO aquellos donde le falta algo.
 *
 * A quien únicamente le falta el teléfono no se le hacen pasar cuatro pantallas
 * de datos que ya dio — se aburre, lo deja a medias y seguimos sin el teléfono.
 */
export function pasosNecesarios(pendientes: CampoPendiente[]): PasoFicha[] {
  const orden: PasoFicha[] = ["identidad", "domicilio", "emergencia", "ropa", "documentos"];
  const hacenFalta = new Set(pendientes.map((p) => p.paso));
  return orden.filter((p) => hacenFalta.has(p));
}

/** Los tres documentos que sube el propio empleado, por si hay que nombrarlos. */
export const COLUMNAS_DOCUMENTO = [
  "doc_dni_anverso_path",
  "doc_dni_reverso_path",
  "doc_iban_path",
] as const;

/**
 * Funde las fichas de una persona (una por empresa) en una sola para revisarla.
 *
 * Los DATOS son de la persona y al guardarse se escriben en todas sus fichas:
 * basta que los tenga en UNA para no volver a pedírselos. Los DOCUMENTOS, en
 * cambio, viven en el almacén de cada empresa por separado, así que se exigen en
 * TODAS: si solo están en una, su ficha de la otra sigue sin papeles.
 *
 * Lo usan el guard y el parte diario, y tiene que dar lo mismo en los dos: si el
 * correo dijera que a alguien le falta algo que el guard no le pide, se
 * reclamaría por carta algo que la app da por bueno.
 */
export function fundirFichas(fichas: Record<string, unknown>[]): FichaParaRevisar {
  const fundida: Record<string, unknown> = {};
  const campos = COLUMNAS_REVISION.split(",").map((c) => c.trim());

  for (const campo of campos) {
    if ((COLUMNAS_DOCUMENTO as readonly string[]).includes(campo)) {
      const enTodas = fichas.every((f) => !vacio(f[campo]));
      fundida[campo] = enTodas ? fichas[0]?.[campo] ?? null : null;
    } else {
      fundida[campo] = fichas.find((f) => !vacio(f[campo]))?.[campo] ?? null;
    }
  }
  return fundida as FichaParaRevisar;
}
