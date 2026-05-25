import type {
  DiscrepanciaTipo,
  LineaFactura,
  OcrFacturaLinea,
  ComparativaResumen,
} from "@/features/logistica/types/facturas";

// Tolerancias por defecto
const TOLERANCIA_PRECIO_ABS = 0.01;   // 1 céntimo
const TOLERANCIA_PRECIO_PCT = 0.005;  // 0.5%
const TOLERANCIA_CANTIDAD_ABS = 0.01;
const TOLERANCIA_IVA_ABS = 0.5;       // medio punto porcentual

export interface LineaSistema {
  id: string;
  productoId: string | null;
  nombre: string;
  cantidad: number;
  unidad: string;
  formato: string;
  precioUnitario: number;
  ivaPorcentaje: number;
  importeLinea: number;
}

function normalizarNombre(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Distancia Levenshtein simple (corta-cadenas suelen ser <60 chars, OK para iterar)
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  const curr = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function similitudNombre(a: string, b: string): number {
  const na = normalizarNombre(a);
  const nb = normalizarNombre(b);
  if (!na.length || !nb.length) return 0;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - dist / maxLen;
}

function precioDifiere(a: number, b: number): boolean {
  const abs = Math.abs(a - b);
  if (abs <= TOLERANCIA_PRECIO_ABS) return false;
  const base = Math.max(Math.abs(a), Math.abs(b), 0.0001);
  return abs / base > TOLERANCIA_PRECIO_PCT;
}

function cantidadDifiere(a: number, b: number): boolean {
  return Math.abs(a - b) > TOLERANCIA_CANTIDAD_ABS;
}

function ivaDifiere(a: number, b: number): boolean {
  return Math.abs(a - b) > TOLERANCIA_IVA_ABS;
}

function formatoDifiere(a: string, b: string): boolean {
  return normalizarNombre(a) !== normalizarNombre(b);
}

function detectarTipo(sis: LineaSistema, ocr: OcrFacturaLinea): DiscrepanciaTipo | null {
  if (cantidadDifiere(sis.cantidad, ocr.cantidad)) return "cantidad";
  if (precioDifiere(sis.precioUnitario, ocr.precioUnitario)) return "precio";
  if (ivaDifiere(sis.ivaPorcentaje, ocr.ivaPorcentaje)) return "iva";
  if (formatoDifiere(sis.formato, ocr.formato)) return "formato";
  if (similitudNombre(sis.nombre, ocr.nombre) < 0.85) return "nombre";
  if (precioDifiere(sis.importeLinea, ocr.importeLinea)) return "importe";
  return null;
}

export interface ComparativaCompleta {
  lineas: LineaFactura[];           // listas combinadas, con discrepancia_tipo y valorSistema
  resumen: ComparativaResumen;
}

/**
 * Compara líneas del sistema (albarán de origen) contra líneas extraídas por OCR
 * de la factura del proveedor. Devuelve un array combinado de `LineaFactura`
 * con la clasificación lista para mostrar en la UI.
 *
 * Estrategia de matching:
 *  1. Match exacto por producto_id (si la línea OCR fue resuelta a un producto)
 *  2. Match por similitud de nombre normalizado > 0.85
 *  3. Líneas OCR sin par → "extra"
 *  4. Líneas sistema sin par → "faltante"
 */
export function compararLineas(
  sistema: LineaSistema[],
  ocr: OcrFacturaLinea[],
): ComparativaCompleta {
  const resultado: LineaFactura[] = [];
  const usadosSistema = new Set<number>();

  // 1. Iterar OCR y buscar mejor match en sistema
  ocr.forEach((linOcr, idxOcr) => {
    let mejorIdx = -1;
    let mejorScore = 0;
    sistema.forEach((linSis, idxSis) => {
      if (usadosSistema.has(idxSis)) return;
      const score = similitudNombre(linSis.nombre, linOcr.nombre);
      if (score > mejorScore) {
        mejorScore = score;
        mejorIdx = idxSis;
      }
    });

    if (mejorIdx >= 0 && mejorScore >= 0.7) {
      const linSis = sistema[mejorIdx];
      usadosSistema.add(mejorIdx);
      const tipo = detectarTipo(linSis, linOcr);
      resultado.push({
        id: `lin-${idxOcr}`,
        productoId: linSis.productoId,
        origen: "ocr",
        nombre: linOcr.nombre,
        cantidad: linOcr.cantidad,
        unidad: linOcr.unidad,
        formato: linOcr.formato,
        precioUnitario: linOcr.precioUnitario,
        ivaPorcentaje: linOcr.ivaPorcentaje,
        importeLinea: linOcr.importeLinea,
        discrepanciaTipo: tipo,
        discrepanciaResolucion: null,
        valorSistema: {
          nombre: linSis.nombre,
          cantidad: linSis.cantidad,
          unidad: linSis.unidad,
          formato: linSis.formato,
          precioUnitario: linSis.precioUnitario,
          ivaPorcentaje: linSis.ivaPorcentaje,
          importeLinea: linSis.importeLinea,
        },
        orden: idxOcr,
      });
    } else {
      // Extra: existe en factura proveedor pero no en albarán
      resultado.push({
        id: `lin-${idxOcr}-extra`,
        productoId: null,
        origen: "ocr",
        nombre: linOcr.nombre,
        cantidad: linOcr.cantidad,
        unidad: linOcr.unidad,
        formato: linOcr.formato,
        precioUnitario: linOcr.precioUnitario,
        ivaPorcentaje: linOcr.ivaPorcentaje,
        importeLinea: linOcr.importeLinea,
        discrepanciaTipo: "extra",
        discrepanciaResolucion: null,
        valorSistema: null,
        orden: idxOcr,
      });
    }
  });

  // 2. Líneas sistema sin emparejar → faltantes
  sistema.forEach((linSis, idxSis) => {
    if (usadosSistema.has(idxSis)) return;
    resultado.push({
      id: `lin-falt-${idxSis}`,
      productoId: linSis.productoId,
      origen: "albaran",
      nombre: linSis.nombre,
      cantidad: linSis.cantidad,
      unidad: linSis.unidad,
      formato: linSis.formato,
      precioUnitario: linSis.precioUnitario,
      ivaPorcentaje: linSis.ivaPorcentaje,
      importeLinea: linSis.importeLinea,
      discrepanciaTipo: "faltante",
      discrepanciaResolucion: null,
      valorSistema: {
        nombre: linSis.nombre,
        cantidad: linSis.cantidad,
        unidad: linSis.unidad,
        formato: linSis.formato,
        precioUnitario: linSis.precioUnitario,
        ivaPorcentaje: linSis.ivaPorcentaje,
        importeLinea: linSis.importeLinea,
      },
      orden: ocr.length + idxSis,
    });
  });

  // 3. Resumen
  let coincidencias = 0;
  let diferencias = 0;
  let extras = 0;
  let faltantes = 0;
  resultado.forEach((l) => {
    switch (l.discrepanciaTipo) {
      case null:
        coincidencias++;
        break;
      case "extra":
        extras++;
        break;
      case "faltante":
        faltantes++;
        break;
      default:
        diferencias++;
    }
  });

  return {
    lineas: resultado.sort((a, b) => a.orden - b.orden),
    resumen: {
      totalLineas: resultado.length,
      coincidencias,
      diferencias,
      extras,
      faltantes,
      hayAlerta: diferencias + extras + faltantes > 0,
    },
  };
}
