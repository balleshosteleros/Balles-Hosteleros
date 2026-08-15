import "server-only";

/**
 * OCR EXTRACTIVO de albaranes de proveedor — extractor ÚNICO (PRP-073 · ampliado en PRP-074).
 *
 * Extraído de `asistente-albaran-actions.ts` para que el flujo por importación
 * (OCR desde Storage) y el legado (base64 directo) usen EXACTAMENTE el mismo
 * prompt, schema y normalización. Cuando la recepción contra pedido converja
 * (Fase 6), también consumirá este módulo.
 *
 * PRP-074 — el extractor deja de ser "solo líneas de producto" y pasa a leer todo
 * lo que la mesa de incidencias necesita para PROPONER en vez de preguntar:
 *  1. Datos FISCALES del proveedor (CIF, razón social, dirección) → ancla de identidad
 *     real, en vez de casar por parecido de nombre ("GARCIMAR" vs "GARCIMAR SL").
 *  2. Continuidad del documento ("SUMA Y SIGUE", "pág. 1 de 2") → detectar que falta
 *     una página ANTES de cargarlo como si estuviera completo.
 *  3. Líneas de SERVICIO (portes, envases, desplazamiento) — antes se descartaban a
 *     propósito y descuadraban el total. Ahora se leen marcadas con `esServicio`.
 *  4. Desglose de IVA del pie (base + cuota por tipo) → cuadrar el documento por tipo
 *     impositivo, no con un único total agregado.
 *  5. Confianza por línea → saber cuándo la foto no da para fiarse.
 */

import { randomUUID } from "crypto";
import { SchemaType, type Schema } from "@google/generative-ai";
import { geminiJSON, GeminiKeyMissingError } from "@/lib/ia/gemini";

/** Datos fiscales impresos en el documento, para contrastar con la ficha del proveedor. */
export interface FiscalOcrAlbaran {
  /** CIF/NIF tal y como se imprime (sin normalizar). */
  cifNif: string | null;
  razonSocial: string | null;
  direccion: string | null;
  codigoPostal: string | null;
  ciudad: string | null;
  provincia: string | null;
}

/** Un tramo del desglose de IVA del pie del documento. */
export interface DesgloseIvaOcr {
  /** Porcentaje del tramo (0, 4, 10, 21). */
  tipo: number;
  baseImponible: number | null;
  cuota: number | null;
  /** Recargo de equivalencia del tramo, si el documento lo imprime. */
  recargoEquivalencia: number | null;
}

/**
 * A quién va dirigido el documento. Con esto se detecta que un albarán se está subiendo a
 * la empresa equivocada ANTES de guardarlo: el OCR ve el nombre del restaurante impreso en
 * el papel, así que puede contrastarlo con la empresa activa.
 */
export interface DestinatarioOcrAlbaran {
  cifNif: string | null;
  razonSocial: string | null;
  direccion: string | null;
}

export interface CabeceraOcrAlbaran {
  proveedor: string | null;
  numero: string | null;
  /** YYYY-MM-DD */
  fecha: string | null;
  total: number | null;
  /** Datos fiscales impresos (PRP-074). */
  fiscal: FiscalOcrAlbaran;
  /** A quién va dirigido: permite avisar de albarán subido a la empresa equivocada. */
  destinatario: DestinatarioOcrAlbaran;
  /** Desglose por tipo de IVA del pie (PRP-074). Vacío si el documento no lo imprime. */
  desgloseIva: DesgloseIvaOcr[];
  /** Base imponible total impresa en el pie, si aparece. */
  baseImponible: number | null;
  /** El documento continúa en otra página ("SUMA Y SIGUE", "continúa..."). */
  continuaEnOtraPagina: boolean;
  /** Nº de página leído ("pág. 1 de 3" → 1). */
  paginaActual: number | null;
  /** Total de páginas leído ("pág. 1 de 3" → 3). */
  paginasTotales: number | null;
  /** Importe del "SUMA Y SIGUE" si aparece — sirve para cuadrar el trozo cargado. */
  sumaYSigue: number | null;
}

/** Línea leída por el OCR de un albarán suelto (incluye datos para el jsonb). */
export interface LineaOcrAlbaran {
  /** id temporal de la línea en el cliente (para casar la resolución). */
  id: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number | null;
  iva?: string | null;
  formato?: string | null;
  unidad: string;
  /**
   * Unidades reales que trae UN envase, leídas de la fila de desglose del papel
   * ("SUBUNIDADES: 24"). La `cantidad` sigue siendo el nº de envases comprados:
   * la conversión a unidades la aplica el circuito de equivalencias UNA sola vez
   * (si la cantidad viniera ya desglosada, la confirmación multiplicaría dos veces).
   */
  unidadesPorEnvase?: number | null;
  /** Importe total de la línea tal y como lo imprime el proveedor. */
  importe: number | null;
  /** Referencia/código del artículo en el catálogo DEL PROVEEDOR (ancla de alias fuerte). */
  referenciaProveedor: string | null;
  /** La línea es un gasto o servicio (portes, envase, desplazamiento), no mercancía. */
  esServicio: boolean;
  /** Descuento en % aplicado a la línea, si el documento lo imprime aparte. */
  descuentoPct: number | null;
  /** 0..1 — cómo de legible venía la línea. Por debajo de 0.7 se marca para revisar. */
  confianza: number;
}

const OCR_ALBARAN_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    proveedorNombreDetectado: { type: SchemaType.STRING, nullable: true },
    numeroAlbaranDetectado: { type: SchemaType.STRING, nullable: true },
    fechaAlbaranDetectada: { type: SchemaType.STRING, nullable: true, description: "YYYY-MM-DD" },
    totalDetectado: { type: SchemaType.NUMBER, nullable: true },
    baseImponibleDetectada: { type: SchemaType.NUMBER, nullable: true },

    // --- Identidad fiscal del EMISOR (PRP-074) ---
    cifNifEmisor: { type: SchemaType.STRING, nullable: true },
    razonSocialEmisor: { type: SchemaType.STRING, nullable: true },
    direccionEmisor: { type: SchemaType.STRING, nullable: true },
    codigoPostalEmisor: { type: SchemaType.STRING, nullable: true },
    ciudadEmisor: { type: SchemaType.STRING, nullable: true },
    provinciaEmisor: { type: SchemaType.STRING, nullable: true },

    // --- Identidad del DESTINATARIO: detecta albarán subido a la empresa equivocada ---
    cifNifDestinatario: { type: SchemaType.STRING, nullable: true },
    razonSocialDestinatario: { type: SchemaType.STRING, nullable: true },
    direccionDestinatario: { type: SchemaType.STRING, nullable: true },

    // --- Continuidad del documento (PRP-074) ---
    continuaEnOtraPagina: { type: SchemaType.BOOLEAN, nullable: true },
    paginaActual: { type: SchemaType.NUMBER, nullable: true },
    paginasTotales: { type: SchemaType.NUMBER, nullable: true },
    sumaYSigue: { type: SchemaType.NUMBER, nullable: true },

    // --- Desglose de IVA del pie (PRP-074) ---
    desgloseIva: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          tipo: { type: SchemaType.NUMBER },
          baseImponible: { type: SchemaType.NUMBER },
          cuota: { type: SchemaType.NUMBER },
          recargoEquivalencia: { type: SchemaType.NUMBER },
        },
        required: ["tipo"],
      },
    },

    lineas: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          nombre: { type: SchemaType.STRING },
          referenciaProveedor: { type: SchemaType.STRING },
          cantidad: { type: SchemaType.NUMBER },
          unidad: { type: SchemaType.STRING },
          formato: { type: SchemaType.STRING },
          unidadesPorEnvase: {
            type: SchemaType.NUMBER,
            description: "Unidades reales por envase según la fila de desglose (SUBUNIDADES/CONTENIDO/PIEZAS)",
          },
          precioUnitario: { type: SchemaType.NUMBER },
          descuentoPct: { type: SchemaType.NUMBER },
          ivaPorcentaje: { type: SchemaType.NUMBER },
          importeLinea: { type: SchemaType.NUMBER },
          esServicio: { type: SchemaType.BOOLEAN },
          confianza: { type: SchemaType.NUMBER },
        },
        required: ["nombre", "cantidad"],
      },
    },
  },
  required: ["lineas"],
};

const OCR_ALBARAN_SYSTEM = `
Eres un extractor de albaranes y facturas de proveedores de un restaurante en España.
Lee el documento adjunto (foto o PDF) y devuelve un JSON. NO inventes NADA: si un dato no se
ve con claridad, devuélvelo como null. Es preferible un null a un dato inventado.

CABECERA
- Nombre comercial del proveedor, número de albarán/factura, fecha (YYYY-MM-DD) y total.
- Base imponible total, si el pie la imprime.

IDENTIDAD FISCAL DEL EMISOR (quien EMITE el documento, es decir el proveedor):
- cifNifEmisor: CIF/NIF tal cual, sin espacios ni puntos (ej: B09654955, A28017895).
  Suele ir en la cabecera junto al logo, o al pie. Si ves DOS identificadores fiscales,
  el del EMISOR es el que acompaña al nombre del proveedor, no al del cliente.
- razonSocialEmisor: la denominación legal completa (con S.L., S.A., S.L.U., C.B....).
  Ojo: puede diferir del nombre comercial del logo. Ambos son útiles.
- direccionEmisor, codigoPostalEmisor, ciudadEmisor, provinciaEmisor: domicilio fiscal del emisor.

IDENTIDAD DEL DESTINATARIO (a QUIÉN va dirigido el documento: el restaurante que recibe la
mercancía). Sirve para avisar si el albarán se está subiendo a la empresa equivocada, así que
extráelo SIEMPRE que se lea, aunque parezca redundante:
- cifNifDestinatario: el CIF/NIF que acompaña al nombre del CLIENTE, no al del proveedor.
- razonSocialDestinatario: denominación legal o nombre comercial del cliente tal cual se imprime.
- direccionDestinatario: dirección de entrega o de facturación del cliente.
Aparece bajo etiquetas como "Cliente", "Destinatario", "Enviar a", "Dirección de entrega",
"Facturar a", "Socio" o similares. Si el documento solo trae UN identificador fiscal, es el
del emisor: en ese caso devuelve null en los tres campos del destinatario, no lo adivines.

CONTINUIDAD DEL DOCUMENTO (crítico: si falta una página, el albarán se cargaría incompleto)
- continuaEnOtraPagina: true si ves "SUMA Y SIGUE", "SIGUE", "continúa", "pasa a la página
  siguiente", o si el documento termina en una suma parcial SIN un total final ni pie de IVA.
- sumaYSigue: el importe que acompaña a ese marcador, si lo hay.
- paginaActual / paginasTotales: si imprime "Página 1 de 3" → 1 y 3. Si no lo imprime, null.

DESGLOSE DE IVA (pie del documento) — devuélvelo SIEMPRE que el documento lo imprima
- Un elemento por cada tipo impositivo, con: tipo (0, 4, 10 o 21), baseImponible, cuota y
  recargoEquivalencia si aparece. Es habitual que un albarán tenga VARIOS tipos (ej: 4% de
  alimentación + 21% de bebidas y limpieza). Léelos todos, uno por tramo.

LÍNEAS
- Una entrada por línea del documento, con el nombre TAL Y COMO lo escribe el proveedor
  (no lo traduzcas ni lo normalices), cantidad, unidad (kg, L, ud, caja...), formato,
  precio unitario NETO (con el descuento ya aplicado), descuentoPct si se imprime aparte,
  IVA % e importe de la línea.
- referenciaProveedor: el código/referencia del artículo en el catálogo DEL PROVEEDOR, si la
  columna existe (ej: "REF 4421", "COD. 100238"). Es el identificador más fiable que hay.
- esServicio: true si la línea NO es mercancía sino un gasto o servicio que el proveedor te
  COBRA aparte: portes, transporte, desplazamiento, envase o casco retornable, punto verde,
  gestión de residuos, recargo financiero. IMPORTANTE: inclúyelas SIEMPRE como líneas (antes
  se omitían y el total no cuadraba). Simplemente márcalas con esServicio: true. Son conceptos
  facturados de pleno derecho: llevan su importe y suman al total.
- Incluye TAMBIÉN las líneas de regalo o promoción sin importe (cantidad sí, precio 0 o null).

UNA LÍNEA = UN ARTÍCULO FACTURADO. Esta es la regla más importante y falla a menudo.
Muchos proveedores imprimen CADA artículo en VARIAS filas: una con el nombre y, debajo,
filas de detalle que describen esa misma línea. Esas filas de detalle NO son artículos
nuevos: son atributos del artículo de arriba y debes FUNDIRLAS en él, nunca devolverlas
como entradas propias. Reconócelas porque no tienen nombre de artículo propio, sino una
etiqueta de concepto, y suelen ir indentadas o en tipografía menor. Casos típicos:
- "SUBUNIDADES", "NETO", "UNIDADES", "CONTENIDO", "PIEZAS", "S/UD": indican cuántas unidades
  reales trae el envase de la línea de arriba (ej: la caja son 24 botellas). NO son un
  artículo, y OJO: tampoco cambian la cantidad. \`cantidad\` es SIEMPRE el número de envases
  comprados tal y como lo imprime la columna de cantidad del documento ("1 caja" → cantidad
  1, unidad "caja"). El desglose devuélvelo en \`unidadesPorEnvase\` (24) y refleja el envase
  en formato ("caja de 24"). El sistema multiplica después envases × unidadesPorEnvase con
  su tabla de equivalencias: si devolvieras 24 en cantidad, el stock entraría multiplicado
  dos veces.
- "DTO", "DESCUENTO", "DTO. FIJO", "RAPPEL", "PROMOCIÓN", "BONIFICACIÓN", o cualquier fila de
  importe NEGATIVO: es el descuento de la línea de arriba → va en descuentoPct (o descontado
  ya en precioUnitario), NUNCA como artículo. Un artículo jamás tiene precio negativo.
- "BASE", "IMPONIBLE", "IVA", "CUOTA", "TOTAL LÍNEA", "SUBTOTAL": son cálculos, no artículos.
- Lotes, caducidades, temperaturas, números de serie o de pedido: son trazabilidad, no artículos.
Distinguir de los servicios: portes, punto verde y envases SÍ son artículos facturados (van
con esServicio: true y su importe positivo). Un descuento o una subunidad NO lo son.
Prueba final antes de devolver: la suma de tus líneas debe cuadrar con la base imponible del
pie. Si te sale de más, casi seguro has convertido filas de detalle en artículos.
- confianza: 0 a 1, cómo de seguro estás de haber leído bien esa línea. Usa < 0.7 si el texto
  está borroso, cortado, tachado o impreso en matriz de puntos poco legible.

IVA POR LÍNEA: SOLO si el documento imprime un porcentaje explícito (0, 4, 10 o 21). Muchos
albaranes (p.ej. Makro) imprimen una columna "Imp" con CÓDIGOS de impuesto (1, 2, 5...): eso
NO es un porcentaje — en ese caso devuelve null y deja que el desglose del pie mande.

Idioma: español.
`.trim();

interface OcrAlbaranRaw {
  proveedorNombreDetectado?: string | null;
  numeroAlbaranDetectado?: string | null;
  fechaAlbaranDetectada?: string | null;
  totalDetectado?: number | null;
  baseImponibleDetectada?: number | null;
  cifNifEmisor?: string | null;
  razonSocialEmisor?: string | null;
  direccionEmisor?: string | null;
  codigoPostalEmisor?: string | null;
  ciudadEmisor?: string | null;
  provinciaEmisor?: string | null;
  cifNifDestinatario?: string | null;
  razonSocialDestinatario?: string | null;
  direccionDestinatario?: string | null;
  continuaEnOtraPagina?: boolean | null;
  paginaActual?: number | null;
  paginasTotales?: number | null;
  sumaYSigue?: number | null;
  desgloseIva?: Array<{
    tipo?: number;
    baseImponible?: number;
    cuota?: number;
    recargoEquivalencia?: number;
  }>;
  lineas?: Array<{
    nombre?: string;
    referenciaProveedor?: string;
    cantidad?: number;
    unidad?: string;
    formato?: string;
    unidadesPorEnvase?: number;
    precioUnitario?: number;
    descuentoPct?: number;
    ivaPorcentaje?: number;
    importeLinea?: number;
    esServicio?: boolean;
    confianza?: number;
  }>;
}

export type ResultadoOcrAlbaran =
  | { ok: true; cabecera: CabeceraOcrAlbaran; lineas: LineaOcrAlbaran[] }
  | { ok: false; error: "OCR_EMPTY" | "OCR_FAILED"; message: string };

/** Tipos de IVA admitidos en España para lo que compra un restaurante. */
const TIPOS_IVA_VALIDOS = [0, 4, 10, 21];

const num = (v: unknown): number | null => (Number.isFinite(v) ? (v as number) : null);
const txt = (v: unknown): string | null => (typeof v === "string" ? v.trim() || null : null);

/**
 * Palabras que delatan un gasto/servicio, por si el modelo no marca `esServicio`.
 * Red de seguridad: el prompt ya lo pide, esto cubre el fallo del modelo.
 */
const PISTAS_SERVICIO = [
  "porte", "portes", "transporte", "desplazamiento", "punto verde",
  "gestion de residuos", "recargo financiero", "gastos de gestion",
  "gastos de envio", "embalaje", "suplemento", "cargo",
  "envase retornable", "casco retornable", "deposito envase",
];

/**
 * Red de seguridad por si el modelo no marca `esServicio`.
 * Exige que el gasto sea el concepto PRINCIPAL de la línea: "Alhambra Reserva 0,30
 * retornable" es cerveza, no un cargo de envase.
 */
function pareceServicio(nombre: string): boolean {
  const n = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!n) return false;
  return PISTAS_SERVICIO.some(
    (p) => n === p || n.startsWith(`${p} `) || (p.includes(" ") && n.includes(p)),
  );
}

/** Ejecuta el OCR sobre el documento (base64 interno, nunca del body de una request). */
export async function ejecutarOcrAlbaran(input: {
  base64: string;
  mimeType: string;
}): Promise<ResultadoOcrAlbaran> {
  try {
    const ocr = await geminiJSON<OcrAlbaranRaw>(
      "Extrae los datos estructurados de este albarán del proveedor.",
      {
        systemInstruction: OCR_ALBARAN_SYSTEM,
        responseSchema: OCR_ALBARAN_SCHEMA,
        temperature: 0.1,
        attachments: [{ mimeType: input.mimeType || "image/jpeg", base64: input.base64 }],
      },
    );

    const raw = ocr.data ?? {};
    const lineas: LineaOcrAlbaran[] = (raw.lineas ?? [])
      .filter((l) => (l.nombre ?? "").trim() !== "")
      .map((l) => {
        const nombre = (l.nombre ?? "").trim();
        const confianza = num(l.confianza);
        return {
          id: randomUUID(),
          nombre,
          cantidad: num(l.cantidad) ?? 0,
          precioUnitario: num(l.precioUnitario),
          iva: TIPOS_IVA_VALIDOS.includes(num(l.ivaPorcentaje) ?? -1)
            ? String(l.ivaPorcentaje)
            : null,
          formato: txt(l.formato),
          unidad: (l.unidad ?? "").trim(),
          // Solo un desglose real (>1) aporta información; 0/1/negativos se descartan.
          unidadesPorEnvase: (num(l.unidadesPorEnvase) ?? 0) > 1 ? num(l.unidadesPorEnvase) : null,
          importe: num(l.importeLinea),
          referenciaProveedor: txt(l.referenciaProveedor),
          esServicio: l.esServicio === true || pareceServicio(nombre),
          descuentoPct: num(l.descuentoPct),
          // Sin dato del modelo asumimos legible; el detector ya cruza contra el total.
          confianza: confianza === null ? 1 : Math.min(1, Math.max(0, confianza)),
        };
      });

    if (lineas.length === 0) {
      return {
        ok: false,
        error: "OCR_EMPTY",
        message: "La IA no encontró líneas de producto en el documento. Prueba con una foto más nítida.",
      };
    }

    const desgloseIva: DesgloseIvaOcr[] = (raw.desgloseIva ?? [])
      .map((d) => ({
        tipo: num(d.tipo) ?? -1,
        baseImponible: num(d.baseImponible),
        cuota: num(d.cuota),
        recargoEquivalencia: num(d.recargoEquivalencia),
      }))
      .filter((d) => TIPOS_IVA_VALIDOS.includes(d.tipo));

    const sumaYSigue = num(raw.sumaYSigue);
    const paginaActual = num(raw.paginaActual);
    const paginasTotales = num(raw.paginasTotales);

    return {
      ok: true,
      cabecera: {
        proveedor: txt(raw.proveedorNombreDetectado),
        numero: txt(raw.numeroAlbaranDetectado),
        fecha: txt(raw.fechaAlbaranDetectada),
        total: num(raw.totalDetectado),
        baseImponible: num(raw.baseImponibleDetectada),
        fiscal: {
          cifNif: txt(raw.cifNifEmisor),
          razonSocial: txt(raw.razonSocialEmisor),
          direccion: txt(raw.direccionEmisor),
          codigoPostal: txt(raw.codigoPostalEmisor),
          ciudad: txt(raw.ciudadEmisor),
          provincia: txt(raw.provinciaEmisor),
        },
        destinatario: {
          cifNif: txt(raw.cifNifDestinatario),
          razonSocial: txt(raw.razonSocialDestinatario),
          direccion: txt(raw.direccionDestinatario),
        },
        desgloseIva,
        // El marcador manda; y "pág. 1 de 3" también implica continuidad aunque no lo diga.
        continuaEnOtraPagina:
          raw.continuaEnOtraPagina === true ||
          sumaYSigue !== null ||
          (paginaActual !== null && paginasTotales !== null && paginaActual < paginasTotales),
        paginaActual,
        paginasTotales,
        sumaYSigue,
      },
      lineas,
    };
  } catch (err) {
    if (err instanceof GeminiKeyMissingError) {
      return { ok: false, error: "OCR_FAILED", message: "La IA no está configurada (falta GEMINI_API_KEY)." };
    }
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[ocr-albaran] ejecutarOcrAlbaran:", msg);
    return { ok: false, error: "OCR_FAILED", message: msg };
  }
}
