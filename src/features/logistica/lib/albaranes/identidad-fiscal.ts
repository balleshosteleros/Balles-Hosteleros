/**
 * Identidad fiscal española: validación de CIF/NIF/NIE y contraste del documento
 * escaneado contra la ficha que tenemos grabada del proveedor (PRP-074).
 *
 * Regla de negocio (Iván, 05-ago-2026): cada proveedor tiene DOS identidades.
 *  - La NUESTRA: el nombre corto con el que lo llamamos internamente
 *    (`proveedores.nombre_comercial`). Lo elegimos nosotros y no tiene por qué
 *    coincidir con nada del papel.
 *  - La FISCAL: CIF + razón social + domicilio. Es la que viene impresa en todos
 *    sus documentos y la que DEBE cuadrar siempre.
 *
 * El ancla de identidad es el CIF, no el nombre: "GARCIMAR" y "GARCIMAR SL" son el
 * mismo proveedor si comparten CIF, y son proveedores distintos si no lo comparten
 * por mucho que se parezcan los nombres.
 *
 * Módulo PURO: sin acceso a red ni a BD, testeable en aislamiento.
 *
 * Nota: el repo ya tenía mod-23 (DNI/NIE) en RRHH, pero NO el dígito de control de
 * CIF de persona jurídica — que es justo el que necesita un proveedor. Se implementa
 * aquí porque `src/features/rrhh` valida personas y esto valida empresas.
 */

// ---------------------------------------------------------------------------
// Normalización
// ---------------------------------------------------------------------------

/** Deja el identificador en su forma canónica: mayúsculas, sin espacios ni puntuación. */
export function normalizarCif(valor: string | null | undefined): string {
  if (!valor) return "";
  return valor
    .toUpperCase()
    .replace(/[\s.\-/]/g, "")
    // Prefijo de IVA intracomunitario español: ESB09654955 → B09654955
    .replace(/^ES(?=[A-Z0-9]{9}$)/, "");
}

/** Normaliza un nombre para comparar: sin acentos, sin formas societarias, sin ruido. */
export function normalizarNombreFiscal(valor: string | null | undefined): string {
  if (!valor) return "";
  return valor
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // Formas societarias: S.L., SL, S.A., SLU, SCP, CB, SAU, SLNE...
    .replace(/\b(S\.?\s?L\.?\s?U?\.?|S\.?\s?A\.?\s?U?\.?|S\.?\s?C\.?\s?P?\.?|C\.?\s?B\.?|S\.?L\.?N\.?E\.?|SOCIEDAD LIMITADA|SOCIEDAD ANONIMA)\b/g, " ")
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Validación de dígito de control
// ---------------------------------------------------------------------------

const DNI_LETRAS = "TRWAGMYFPDXBNJZSQVHLCKE";
/** Letras de control de CIF, indexadas por el dígito calculado. */
const CIF_LETRAS = "JABCDEFGHI";
/** Organizaciones cuyo control es SIEMPRE letra. */
const CIF_SOLO_LETRA = "KPQS";
/** Organizaciones cuyo control es SIEMPRE número. */
const CIF_SOLO_NUMERO = "ABEH";
/** Todas las letras válidas de inicio de CIF. */
const CIF_INICIALES = "ABCDEFGHJKLMNPQRSUVW";

export type TipoIdentificadorFiscal = "CIF" | "NIF" | "NIE" | "DESCONOCIDO";

export function detectarTipoFiscal(cif: string): TipoIdentificadorFiscal {
  const c = normalizarCif(cif);
  if (/^[0-9]{8}[A-Z]$/.test(c)) return "NIF";
  if (/^[XYZ][0-9]{7}[A-Z]$/.test(c)) return "NIE";
  if (new RegExp(`^[${CIF_INICIALES}][0-9]{7}[0-9A-J]$`).test(c)) return "CIF";
  return "DESCONOCIDO";
}

function validarNif(c: string): boolean {
  const m = /^([0-9]{8})([A-Z])$/.exec(c);
  if (!m) return false;
  return DNI_LETRAS[parseInt(m[1], 10) % 23] === m[2];
}

function validarNie(c: string): boolean {
  const m = /^([XYZ])([0-9]{7})([A-Z])$/.exec(c);
  if (!m) return false;
  const prefijo = { X: "0", Y: "1", Z: "2" }[m[1] as "X" | "Y" | "Z"];
  return DNI_LETRAS[parseInt(prefijo + m[2], 10) % 23] === m[3];
}

/**
 * Dígito de control de CIF (persona jurídica).
 * Suma los dígitos de posición par tal cual; los de posición impar se duplican y se
 * suman sus cifras. El control es 10 − (suma mod 10), en número o letra según la inicial.
 */
function validarCifJuridico(c: string): boolean {
  const m = new RegExp(`^([${CIF_INICIALES}])([0-9]{7})([0-9A-J])$`).exec(c);
  if (!m) return false;
  const [, inicial, cuerpo, control] = m;

  let suma = 0;
  for (let i = 0; i < cuerpo.length; i++) {
    const d = parseInt(cuerpo[i], 10);
    if (i % 2 === 0) {
      // Posiciones impares del identificador (0-indexadas pares): se duplican.
      const doble = d * 2;
      suma += Math.floor(doble / 10) + (doble % 10);
    } else {
      suma += d;
    }
  }

  const digito = (10 - (suma % 10)) % 10;
  const letra = CIF_LETRAS[digito];

  if (CIF_SOLO_LETRA.includes(inicial)) return control === letra;
  if (CIF_SOLO_NUMERO.includes(inicial)) return control === String(digito);
  // El resto admite ambas formas.
  return control === String(digito) || control === letra;
}

/** ¿Es un identificador fiscal español válido (CIF, NIF o NIE)? */
export function esIdentificadorFiscalValido(valor: string | null | undefined): boolean {
  const c = normalizarCif(valor);
  switch (detectarTipoFiscal(c)) {
    case "NIF":
      return validarNif(c);
    case "NIE":
      return validarNie(c);
    case "CIF":
      return validarCifJuridico(c);
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Contraste documento ↔ ficha del proveedor
// ---------------------------------------------------------------------------

/** Ficha grabada del proveedor, reducida a lo que interviene en el contraste. */
export interface ProveedorFiscal {
  id: string;
  /** El nombre NUESTRO, el que elegimos internamente. */
  nombreComercial: string;
  razonSocial: string | null;
  cifNif: string | null;
  codigoPostal: string | null;
  ciudad: string | null;
  provincia: string | null;
}

/** Lo que viene impreso en el documento escaneado. */
export interface FiscalDocumento {
  cifNif: string | null;
  razonSocial: string | null;
  nombreDetectado: string | null;
  codigoPostal: string | null;
  ciudad: string | null;
  provincia: string | null;
}

export type MotivoCoincidencia =
  | "cif_exacto"
  | "razon_social_exacta"
  | "nombre_parecido";

export interface DiscrepanciaFiscal {
  campo: "cifNif" | "razonSocial" | "codigoPostal" | "ciudad" | "provincia";
  etiqueta: string;
  enFicha: string | null;
  enDocumento: string | null;
  /** Interpretación: ¿es un cambio real que hay que grabar, o ruido de lectura? */
  veredicto: "actualizar_ficha" | "rellenar_hueco" | "revisar" | "ignorable";
  explicacion: string;
}

export interface ResultadoIdentificacion {
  /** El proveedor identificado, si lo hay. */
  proveedor: ProveedorFiscal | null;
  /** Por qué se identificó (o null si no se identificó). */
  motivo: MotivoCoincidencia | null;
  /** 0..1 — seguridad de la identificación. 1 = CIF válido y coincidente. */
  confianza: number;
  /** Diferencias entre lo impreso y lo grabado, ya interpretadas. */
  discrepancias: DiscrepanciaFiscal[];
  /** El CIF del documento no supera el dígito de control. */
  cifDocumentoInvalido: boolean;
  /**
   * Hay un proveedor con ese CIF pero el nombre no se parece en nada, o al revés:
   * el nombre casa pero el CIF es de otro. Señal de alerta para el humano.
   */
  conflictoIdentidad: boolean;
}

/** Parecido 0..1 entre dos cadenas ya normalizadas (Levenshtein + contención). */
function similitud(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;

  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = tmp;
    }
  }
  return 1 - dp[n] / Math.max(m, n);
}

const UMBRAL_NOMBRE = 0.82;

function compararCampo(
  campo: DiscrepanciaFiscal["campo"],
  etiqueta: string,
  enFicha: string | null,
  enDocumento: string | null,
): DiscrepanciaFiscal | null {
  const ficha = (enFicha ?? "").trim();
  const doc = (enDocumento ?? "").trim();

  // El documento no lo imprime: no hay nada que contrastar.
  if (!doc) return null;

  // Lo tenemos vacío y el papel lo trae: hueco que se puede rellenar solo.
  if (!ficha) {
    return {
      campo,
      etiqueta,
      enFicha: null,
      enDocumento: doc,
      veredicto: "rellenar_hueco",
      explicacion: `No teníamos ${etiqueta.toLowerCase()} de este proveedor. El documento trae "${doc}".`,
    };
  }

  const normFicha = campo === "cifNif" ? normalizarCif(ficha) : normalizarNombreFiscal(ficha);
  const normDoc = campo === "cifNif" ? normalizarCif(doc) : normalizarNombreFiscal(doc);
  if (normFicha === normDoc) return null;

  // Diferencias de forma (acentos, S.L., puntuación) no son discrepancias reales.
  const parecido = similitud(normFicha, normDoc);
  if (parecido >= 0.95) {
    return {
      campo,
      etiqueta,
      enFicha: ficha,
      enDocumento: doc,
      veredicto: "ignorable",
      explicacion: `Misma ${etiqueta.toLowerCase()} escrita de otra forma. No hace falta tocar nada.`,
    };
  }

  if (campo === "cifNif") {
    return {
      campo,
      etiqueta,
      enFicha: ficha,
      enDocumento: doc,
      veredicto: "revisar",
      explicacion:
        `El CIF del documento (${doc}) NO coincide con el que tenemos grabado (${ficha}). ` +
        `O es otro proveedor, o uno de los dos está mal escrito.`,
    };
  }

  // Domicilio: un cambio real de dirección es normal y se graba.
  if (campo === "codigoPostal" || campo === "ciudad" || campo === "provincia") {
    return {
      campo,
      etiqueta,
      enFicha: ficha,
      enDocumento: doc,
      veredicto: "actualizar_ficha",
      explicacion: `El proveedor imprime "${doc}" y nosotros tenemos "${ficha}". Puede haber cambiado de domicilio.`,
    };
  }

  return {
    campo,
    etiqueta,
    enFicha: ficha,
    enDocumento: doc,
    veredicto: "revisar",
    explicacion: `La ${etiqueta.toLowerCase()} del documento no coincide con la grabada.`,
  };
}

/**
 * Identifica al proveedor del documento contra el catálogo, priorizando el CIF.
 *
 * Orden de evidencia:
 *  1. CIF coincidente → identidad segura (confianza 1). El nombre da igual.
 *  2. Razón social exacta (normalizada) → confianza alta.
 *  3. Nombre parecido por encima del umbral → confianza media, se pide confirmación.
 */
export function identificarProveedor(
  doc: FiscalDocumento,
  catalogo: ProveedorFiscal[],
): ResultadoIdentificacion {
  const cifDoc = normalizarCif(doc.cifNif);
  const cifDocumentoInvalido = cifDoc !== "" && !esIdentificadorFiscalValido(cifDoc);

  const base = {
    cifDocumentoInvalido,
    conflictoIdentidad: false,
    discrepancias: [] as DiscrepanciaFiscal[],
  };

  // --- 1. Por CIF: la identidad de verdad ---
  if (cifDoc && !cifDocumentoInvalido) {
    const porCif = catalogo.find((p) => normalizarCif(p.cifNif) === cifDoc);
    if (porCif) {
      const nombreDoc = normalizarNombreFiscal(doc.razonSocial ?? doc.nombreDetectado);
      const nombreFicha = normalizarNombreFiscal(porCif.razonSocial ?? porCif.nombreComercial);
      // Mismo CIF con nombre irreconocible: raro, merece un vistazo humano.
      const conflicto = nombreDoc !== "" && similitud(nombreDoc, nombreFicha) < 0.5;

      return {
        ...base,
        proveedor: porCif,
        motivo: "cif_exacto",
        confianza: 1,
        conflictoIdentidad: conflicto,
        discrepancias: construirDiscrepancias(doc, porCif),
      };
    }
  }

  // --- 2. Por razón social exacta ---
  const rsDoc = normalizarNombreFiscal(doc.razonSocial);
  if (rsDoc) {
    const porRs = catalogo.find(
      (p) => normalizarNombreFiscal(p.razonSocial) === rsDoc && rsDoc !== "",
    );
    if (porRs) {
      // Mismo nombre legal pero CIF distinto: casi seguro que uno está mal.
      const cifFicha = normalizarCif(porRs.cifNif);
      const conflicto = cifDoc !== "" && cifFicha !== "" && cifDoc !== cifFicha;
      return {
        ...base,
        proveedor: porRs,
        motivo: "razon_social_exacta",
        confianza: conflicto ? 0.6 : 0.9,
        conflictoIdentidad: conflicto,
        discrepancias: construirDiscrepancias(doc, porRs),
      };
    }
  }

  // --- 3. Por parecido de nombre: lo más débil, siempre a confirmar ---
  const textoDoc = normalizarNombreFiscal(doc.nombreDetectado ?? doc.razonSocial);
  if (textoDoc) {
    let mejor: { p: ProveedorFiscal; score: number } | null = null;
    for (const p of catalogo) {
      const score = Math.max(
        similitud(textoDoc, normalizarNombreFiscal(p.nombreComercial)),
        similitud(textoDoc, normalizarNombreFiscal(p.razonSocial)),
      );
      if (!mejor || score > mejor.score) mejor = { p, score };
    }
    if (mejor && mejor.score >= UMBRAL_NOMBRE) {
      const cifFicha = normalizarCif(mejor.p.cifNif);
      const conflicto = cifDoc !== "" && cifFicha !== "" && cifDoc !== cifFicha;
      return {
        ...base,
        proveedor: mejor.p,
        motivo: "nombre_parecido",
        // Si el CIF del papel contradice al de la ficha, la identificación no vale.
        confianza: conflicto ? 0.4 : Math.min(0.85, mejor.score),
        conflictoIdentidad: conflicto,
        discrepancias: construirDiscrepancias(doc, mejor.p),
      };
    }
  }

  return { ...base, proveedor: null, motivo: null, confianza: 0 };
}

function construirDiscrepancias(
  doc: FiscalDocumento,
  p: ProveedorFiscal,
): DiscrepanciaFiscal[] {
  return [
    compararCampo("cifNif", "CIF/NIF", p.cifNif, doc.cifNif),
    compararCampo("razonSocial", "Razón social", p.razonSocial, doc.razonSocial),
    compararCampo("codigoPostal", "Código postal", p.codigoPostal, doc.codigoPostal),
    compararCampo("ciudad", "Población", p.ciudad, doc.ciudad),
    compararCampo("provincia", "Provincia", p.provincia, doc.provincia),
  ].filter((d): d is DiscrepanciaFiscal => d !== null);
}
