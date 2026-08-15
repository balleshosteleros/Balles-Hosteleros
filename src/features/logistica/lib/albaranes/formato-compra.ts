/**
 * INTERPRETACIÓN DE FORMATOS DE COMPRA (PRP-074).
 *
 * Regla de negocio (Iván, 05-ago-2026):
 *
 *   Un formato tiene SIEMPRE dos partes: un NÚMERO y una MEDIDA.
 *     "caja de 24 unidades"  → 24 × ud
 *     "garrafa de 5 litros"  →  5 × L
 *     "saco de 3 kilos"      →  3 × kg
 *
 *   Y lo que sube al stock es SIEMPRE:
 *     cantidad comprada × contenido del formato
 *     3 cajas de 24 ud  → 72 ud
 *     2 garrafas de 5 L → 10 L
 *
 * Cada proveedor lo escribe a su manera ("CJ. 12x1L", "3 UD x 5 KG", "PACK-6",
 * "BOT. 1,5L C/6"). Este módulo interpreta todas esas formas y devuelve SIEMPRE
 * lo mismo: cuánto contiene un envase y en qué medida.
 *
 * Módulo PURO: sin red, sin BD, sin estado. Testeable en aislamiento.
 */

// ---------------------------------------------------------------------------
// Medidas
// ---------------------------------------------------------------------------

/** Las tres medidas base del catálogo (tabla `medidas`: Unidades, Kilogramos, Litros). */
export type MedidaBase = "ud" | "kg" | "l";

/**
 * Sinónimos por medida, incluidas las submedidas con su factor de conversión a la
 * base. Un albarán en gramos o mililitros debe entrar al stock en kg / L.
 */
const SINONIMOS: Array<{ base: MedidaBase; factor: number; formas: string[] }> = [
  // Unidades
  { base: "ud", factor: 1, formas: ["ud", "uds", "u", "un", "und", "unid", "unidad", "unidades", "pza", "pzas", "pieza", "piezas", "bot", "botella", "botellas", "lata", "latas", "brick", "bricks", "sobre", "sobres", "bolsa", "bolsas", "tarrina", "tarrinas", "bote", "botes", "barra", "barras"] },
  { base: "ud", factor: 12, formas: ["docena", "docenas", "dna"] },
  // Peso
  { base: "kg", factor: 1, formas: ["kg", "kgs", "kilo", "kilos", "kilogramo", "kilogramos", "k"] },
  { base: "kg", factor: 0.001, formas: ["g", "gr", "grs", "gramo", "gramos"] },
  // Volumen
  { base: "l", factor: 1, formas: ["l", "lt", "lts", "litro", "litros"] },
  { base: "l", factor: 0.001, formas: ["ml", "mls", "mililitro", "mililitros", "cc"] },
  { base: "l", factor: 0.01, formas: ["cl", "cls", "centilitro", "centilitros"] },
];

/**
 * Envases: NO son una medida, son un continente. "Caja" no dice cuánto lleva.
 * Si una línea viene en un envase y no sabemos su contenido, el stock entraría mal.
 */
const ENVASES = [
  // "caj" y "cajon/es": mismas abreviaturas que la lista de contenedoras del RPC
  // (hotfix 07-ago, ALB-2026-023) — las dos listas deben reconocer lo mismo.
  "caja", "cajas", "caj", "cja", "cjas", "cj", "c", "cajon", "cajones", "box", "pack", "packs", "pk",
  "bandeja", "bandejas", "band", "saco", "sacos", "garrafa", "garrafas",
  "bidon", "bidones", "fardo", "fardos", "lote", "lotes", "palet", "palets",
  "estuche", "estuches", "cubeta", "cubetas", "barril", "barriles",
  "cesta", "cestas", "malla", "mallas", "atado", "atados", "display",
];

export function normalizarTexto(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9,.\s/x×*-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Convierte un texto de medida a su base y factor. Null si no es una medida. */
export function interpretarMedida(
  texto: string | null | undefined,
): { base: MedidaBase; factor: number } | null {
  const t = normalizarTexto(texto).replace(/[.\s]/g, "");
  if (!t) return null;
  for (const grupo of SINONIMOS) {
    if (grupo.formas.includes(t)) return { base: grupo.base, factor: grupo.factor };
  }
  return null;
}

/** ¿Este texto nombra un envase (caja, pack, garrafa...) en vez de una medida? */
export function esEnvase(texto: string | null | undefined): boolean {
  const t = normalizarTexto(texto).replace(/[.\s]/g, "");
  return ENVASES.includes(t);
}

// ---------------------------------------------------------------------------
// Interpretación del formato
// ---------------------------------------------------------------------------

export interface FormatoInterpretado {
  /** Cuánto contiene UN envase, ya en la medida base (caja de 24 ud → 24). */
  contenido: number;
  /** La medida base del contenido. */
  medida: MedidaBase;
  /** Nombre del envase si lo hay ("caja", "garrafa"). Null si se compra suelto. */
  envase: string | null;
  /** Cómo se dedujo, para explicárselo al usuario. */
  origen:
    | "subunidades"      // fila de desglose del papel ("SUBUNIDADES: 24")
    | "explicito"        // "caja de 24 unidades"
    | "multiplicacion"   // "12x1L"
    | "envase_numero"    // "PACK-6"
    | "medida_suelta"    // "5 L"
    | "unitario";        // sin formato: 1 a 1
  /** 0..1 — cómo de seguros estamos. Por debajo de 0.8 conviene confirmarlo. */
  confianza: number;
  /** Frase corta en español para la propuesta. */
  descripcion: string;
}

const NUM = String.raw`(\d{1,5}(?:[.,]\d{1,3})?)`;
/** Une los sinónimos en una alternativa de regex, del más largo al más corto. */
const MEDIDAS_RE = SINONIMOS.flatMap((g) => g.formas)
  .sort((a, b) => b.length - a.length)
  .join("|");
const ENVASES_RE = ENVASES.sort((a, b) => b.length - a.length).join("|");

const aNumero = (s: string): number => parseFloat(s.replace(",", "."));

/**
 * Interpreta el formato de una línea de albarán.
 *
 * Mira, por este orden, el texto de formato, la unidad y el nombre del producto —
 * porque cada proveedor pone el dato en un sitio distinto.
 *
 * @param formato  columna "formato" del albarán, si existe
 * @param unidad   columna "unidad" del albarán
 * @param nombre   nombre de la línea (muchos proveedores meten aquí el formato)
 * @param medidaProducto  medida base de NUESTRA ficha, para resolver ambigüedades
 * @param unidadesPorEnvase  desglose impreso en el papel ("SUBUNIDADES: 24"), si el OCR lo leyó
 */
export function interpretarFormato(
  formato: string | null | undefined,
  unidad: string | null | undefined,
  nombre: string | null | undefined,
  medidaProducto?: MedidaBase | null,
  unidadesPorEnvase?: number | null,
): FormatoInterpretado {
  const candidatos = [formato, unidad, nombre].map(normalizarTexto);

  // --- 0-bis (prioridad máxima). El desglose impreso en el propio albarán: el
  // proveedor DECLARA cuántas unidades trae el envase ("1 caja / 24 subunidades").
  // Es más fiable que cualquier interpretación del texto, así que manda sobre todas.
  if (unidadesPorEnvase != null && unidadesPorEnvase > 1) {
    const envase = candidatos.map((t) => (t ? nombreEnvaseEn(t) : null)).find((e) => e !== null) ?? null;
    return {
      contenido: redondear(unidadesPorEnvase),
      medida: "ud",
      envase,
      origen: "subunidades",
      confianza: 0.95,
      descripcion: `1 ${envase ?? "envase"} = ${formatearNumero(unidadesPorEnvase)} unidades (desglose del albarán)`,
    };
  }

  for (const texto of candidatos) {
    if (!texto) continue;

    // --- 0. Códigos comprimidos de fabricante: "C24", "P6", "E12".
    // Coca-Cola imprime "COCACOLA VR237 C24" = envase retornable de 237 ml en caja
    // de 24. Sin esto entrarían 2 cajas al almacén en vez de 48 botellas.
    // Se exige que el número vaya pegado a la letra y que sea un tamaño de caja
    // plausible, para no confundirlo con un código de artículo cualquiera.
    const reCodigo = /\b([cpe])\s?(\d{1,3})\b/;
    const mCod = reCodigo.exec(texto);
    if (mCod) {
      const n = parseInt(mCod[2], 10);
      // Tamaños reales de caja/pack en hostelería.
      if (n >= 4 && n <= 48) {
        const med = medidaBasePorDefecto(medidaProducto);
        const envase = mCod[1] === "p" ? "pack" : "caja";
        return {
          contenido: redondear(n),
          medida: med.base,
          envase,
          origen: "envase_numero",
          // Por debajo de 0.8: la UI lo marca para que una persona lo confirme.
          confianza: 0.75,
          descripcion: `1 ${envase} = ${formatearNumero(n)} ${etiqueta(med.base)}`,
        };
      }
    }

    // --- 1. Envase con contenido explícito: "caja de 24 unidades", "garrafa 5 l"
    const reExplicito = new RegExp(
      String.raw`\b(${ENVASES_RE})\b[\s.:-]*(?:de\s+|con\s+|x\s*)?${NUM}\s*(${MEDIDAS_RE})?\b`,
    );
    const mExp = reExplicito.exec(texto);
    if (mExp) {
      const envase = mExp[1];
      const n = aNumero(mExp[2]);
      const med = interpretarMedida(mExp[3]) ?? medidaBasePorDefecto(medidaProducto);
      if (n > 0) {
        return {
          contenido: redondear(n * med.factor),
          medida: med.base,
          envase,
          origen: "explicito",
          confianza: mExp[3] ? 0.95 : 0.85,
          descripcion: `1 ${envase} = ${formatearNumero(n * med.factor)} ${etiqueta(med.base)}`,
        };
      }
    }

    // --- 1b. Recuento de piezas: "85g x 54u", "1,5L (6u)", "500ml x 12 uds"
    // Cuando el texto trae un TAMAÑO (peso/volumen de cada pieza) y además un
    // RECUENTO de piezas, lo que multiplica el stock es el recuento, no el tamaño:
    // "PAN BRIOCHE 85g x 54u" son 54 panes, no 85 gramos.
    const UD_RE = SINONIMOS.filter((g) => g.base === "ud" && g.factor === 1)
      .flatMap((g) => g.formas)
      .sort((a, b) => b.length - a.length)
      .join("|");
    // El separador puede ser "x", "×", "*", un paréntesis (que `normalizarTexto`
    // convierte en espacio) o simplemente un espacio: "1,5L (6u)" → "1,5l 6u".
    const rePiezas = new RegExp(
      String.raw`${NUM}\s*(?:${MEDIDAS_RE})\b[\s.]*(?:[x×*(]\s*)?${NUM}\s*(?:${UD_RE})\b`,
    );
    const mPiezas = rePiezas.exec(texto);
    if (mPiezas) {
      const piezas = aNumero(mPiezas[2]);
      if (piezas > 1) {
        return {
          contenido: redondear(piezas),
          medida: "ud",
          envase: nombreEnvaseEn(texto),
          origen: "multiplicacion",
          confianza: 0.9,
          descripcion: `1 ${nombreEnvaseEn(texto) ?? "envase"} = ${formatearNumero(piezas)} unidades`,
        };
      }
    }

    // --- 2. Multiplicación: "12x1L", "6 x 750 ml", "24×33cl"
    const reMult = new RegExp(String.raw`${NUM}\s*[x×*]\s*${NUM}\s*(${MEDIDAS_RE})\b`);
    const mMult = reMult.exec(texto);
    if (mMult) {
      const piezas = aNumero(mMult[1]);
      const porPieza = aNumero(mMult[2]);
      const med = interpretarMedida(mMult[3]);
      if (med && piezas > 0 && porPieza > 0) {
        // "12x1L" = 12 botellas de 1 L = 12 L en total.
        const total = piezas * porPieza * med.factor;
        // Si nuestra ficha lleva el producto por unidades, lo que importa son las 12.
        const porUnidades = medidaProducto === "ud";
        return {
          contenido: redondear(porUnidades ? piezas : total),
          medida: porUnidades ? "ud" : med.base,
          envase: nombreEnvaseEn(texto),
          origen: "multiplicacion",
          confianza: 0.9,
          descripcion: porUnidades
            ? `1 envase = ${formatearNumero(piezas)} unidades (de ${formatearNumero(porPieza)} ${etiqueta(med.base)} cada una)`
            : `1 envase = ${formatearNumero(piezas)} × ${formatearNumero(porPieza)} ${etiqueta(med.base)} = ${formatearNumero(total)} ${etiqueta(med.base)}`,
        };
      }
    }

    // --- 3. Multiplicación sin medida: "12x1", "PACK 6x"
    const reMultSimple = new RegExp(String.raw`\b${NUM}\s*[x×*]\s*${NUM}\b(?!\s*(?:${MEDIDAS_RE}))`);
    const mSimple = reMultSimple.exec(texto);
    if (mSimple) {
      const piezas = aNumero(mSimple[1]);
      if (piezas > 1) {
        const med = medidaBasePorDefecto(medidaProducto);
        return {
          contenido: redondear(piezas),
          medida: med.base,
          envase: nombreEnvaseEn(texto),
          origen: "multiplicacion",
          confianza: 0.7,
          descripcion: `1 envase = ${formatearNumero(piezas)} ${etiqueta(med.base)}`,
        };
      }
    }

    // --- 4. Envase + número pegado: "PACK-6", "CJ 24", "caja12"
    const reEnvNum = new RegExp(String.raw`\b(${ENVASES_RE})\b[\s.:_-]*${NUM}\b`);
    const mEnvNum = reEnvNum.exec(texto);
    if (mEnvNum) {
      const n = aNumero(mEnvNum[2]);
      if (n > 1) {
        const med = medidaBasePorDefecto(medidaProducto);
        return {
          contenido: redondear(n),
          medida: med.base,
          envase: mEnvNum[1],
          origen: "envase_numero",
          confianza: 0.75,
          descripcion: `1 ${mEnvNum[1]} = ${formatearNumero(n)} ${etiqueta(med.base)}`,
        };
      }
    }

    // --- 5. Número + envase: "6 botellas", "24 uds"
    const reNumMed = new RegExp(String.raw`\b${NUM}\s*(${MEDIDAS_RE})\b`);
    const mNumMed = reNumMed.exec(texto);
    if (mNumMed) {
      const n = aNumero(mNumMed[1]);
      const med = interpretarMedida(mNumMed[2]);
      if (med && n > 0) {
        const envase = nombreEnvaseEn(texto);
        // Sin envase, "5 L" es el tamaño del propio artículo, no un multiplicador:
        // una botella de 5 L es 1 botella. Solo multiplica si hay envase.
        if (!envase && !esEnvase(unidad)) {
          return unitario(medidaProducto);
        }
        return {
          contenido: redondear(n * med.factor),
          medida: med.base,
          envase,
          origen: "medida_suelta",
          confianza: 0.8,
          descripcion: `1 ${envase ?? "envase"} = ${formatearNumero(n * med.factor)} ${etiqueta(med.base)}`,
        };
      }
    }
  }

  return unitario(medidaProducto);
}

function unitario(medidaProducto?: MedidaBase | null): FormatoInterpretado {
  const med = medidaBasePorDefecto(medidaProducto);
  return {
    contenido: 1,
    medida: med.base,
    envase: null,
    origen: "unitario",
    confianza: 1,
    descripcion: `1 ${etiqueta(med.base)} por cada unidad comprada`,
  };
}

function medidaBasePorDefecto(m?: MedidaBase | null): { base: MedidaBase; factor: number } {
  return { base: m ?? "ud", factor: 1 };
}

function nombreEnvaseEn(texto: string): string | null {
  const m = new RegExp(String.raw`\b(${ENVASES_RE})\b`).exec(texto);
  return m ? m[1] : null;
}

function redondear(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function etiqueta(m: MedidaBase): string {
  return m === "ud" ? "unidades" : m === "kg" ? "kg" : "L";
}

export function formatearNumero(n: number): string {
  // Coma decimal (regla de formato del proyecto).
  return (Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, "").replace(/\.$/, ""))
    .replace(".", ",");
}

// ---------------------------------------------------------------------------
// Cálculo del stock
// ---------------------------------------------------------------------------

export interface CalculoStock {
  /** Lo que de verdad entra en el almacén. */
  cantidadStock: number;
  medida: MedidaBase;
  /** Contenido de un envase que se ha aplicado. */
  equivalencia: number;
  /** "3 cajas × 24 unidades = 72 unidades" */
  explicacion: string;
  formato: FormatoInterpretado;
}

/**
 * cantidad comprada × contenido del formato = lo que sube al stock.
 * Esta es LA regla; todo lo demás es interpretar el papel para llegar aquí.
 */
export function calcularStock(
  cantidadComprada: number,
  formato: FormatoInterpretado,
): CalculoStock {
  const cantidadStock = redondear(cantidadComprada * formato.contenido);
  const uds = etiqueta(formato.medida);

  const explicacion =
    formato.contenido === 1
      ? `${formatearNumero(cantidadComprada)} ${uds}`
      : `${formatearNumero(cantidadComprada)} ${formato.envase ? plural(formato.envase, cantidadComprada) : "×"} ` +
        `× ${formatearNumero(formato.contenido)} ${uds} = ${formatearNumero(cantidadStock)} ${uds}`;

  return {
    cantidadStock,
    medida: formato.medida,
    equivalencia: formato.contenido,
    explicacion,
    formato,
  };
}

function plural(envase: string, n: number): string {
  if (n === 1) return envase;
  return envase.endsWith("s") ? envase : `${envase}s`;
}

/**
 * Contrasta la interpretación con el dinero del papel.
 *
 * Si el proveedor imprime precio unitario e importe, el precio suele ser POR ENVASE
 * (3 cajas × 24,00 € = 72,00 €). Cuando el importe no cuadra con la interpretación,
 * es señal de que el formato se ha leído mal.
 *
 * @returns null si no hay datos para comprobar, o el diagnóstico.
 */
export function contrastarConImporte(
  cantidadComprada: number,
  precioUnitario: number | null,
  importeLinea: number | null,
  tolerancia = 0.05,
): { cuadra: boolean; precioPorEnvase: boolean } | null {
  if (precioUnitario === null || importeLinea === null || cantidadComprada <= 0) return null;

  // Caso normal: el precio es por envase comprado.
  const porEnvase = Math.abs(cantidadComprada * precioUnitario - importeLinea) <= tolerancia;
  return { cuadra: porEnvase, precioPorEnvase: porEnvase };
}
