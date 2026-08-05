/**
 * Comparación pedido ↔ albarán leído por OCR (PRP-073 F6).
 *
 * Sustituye a la Edge Function `analizar-albaran`, que hacía esto mismo pero
 * con código NO versionado en el repo (infra invisible: si se rompía o se
 * borraba, no había forma de saber qué hacía ni de redesplegarla). El OCR ahora
 * lo hace el extractor único (`ocr-albaran.ts`) y esta comparación es un módulo
 * PURO: sin red, sin BD, testeable en aislamiento.
 *
 * Contrato de salida: `AnalisisAlbaran` — EXACTAMENTE el mismo shape que
 * devolvía la Edge Function, para que `ComparativaAlbaran` y las pantallas de
 * recepción no cambien.
 */

import type { AnalisisAlbaran, LineaAnalisis } from "@/features/logistica/data/pedidos";
import type { CabeceraOcrAlbaran, LineaOcrAlbaran } from "./ocr-albaran";

export interface LineaPedidoRef {
  producto: string;
  cantidad: number;
  precioUC: number;
  unidad: string;
}

function normalizar(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Similitud por contención de tokens, asimétrica: el nombre del catálogo es
 * corto y canónico, el del proveedor largo (marca + formato + código). El
 * Jaccard puro castiga esa asimetría; esto pondera cuánto del nombre CORTO
 * está contenido en el largo (el mismo enfoque que ya validamos cargando
 * 58 albaranes a mano en julio).
 */
function tokensAlfa(s: string): string[] {
  return normalizar(s)
    .split(" ")
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t));
}

function similitud(a: string, b: string): number {
  const ta = tokensAlfa(a);
  const tb = tokensAlfa(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const sa = new Set(ta);
  const sb = new Set(tb);
  const ca = ta.join("");
  const cb = tb.join("");
  // Un token casa si aparece exacto en el otro lado O como subcadena del otro
  // nombre pegado (caza "Fuenteliviana" ↔ "FUENTE LIVIANA", "CocaCola" ↔ "Coca Cola").
  const casa = (t: string, otroSet: Set<string>, otroConcat: string) =>
    otroSet.has(t) || (t.length >= 4 && otroConcat.includes(t));
  let ia = 0;
  for (const t of sa) if (casa(t, sb, cb)) ia++;
  let ib = 0;
  for (const t of sb) if (casa(t, sa, ca)) ib++;
  return Math.max(ia / sa.size, ib / sb.size);
}

const UMBRAL_MATCH = 0.4;
const TOLERANCIA_PRECIO = 0.01;
const TOLERANCIA_CANTIDAD = 0.001;

/** Compara las líneas leídas del documento contra las del pedido. */
export function compararConPedido(
  cabecera: CabeceraOcrAlbaran,
  lineasOcr: LineaOcrAlbaran[],
  lineasPedido: LineaPedidoRef[],
): AnalisisAlbaran {
  // Emparejado 1:1 codicioso por mejor similitud (cada línea de pedido casa como
  // mucho con una del documento, y viceversa).
  const pares: Array<{ ocr: number; ped: number; score: number }> = [];
  lineasOcr.forEach((lo, i) => {
    lineasPedido.forEach((lp, j) => {
      const score = similitud(lo.nombre, lp.producto);
      if (score >= UMBRAL_MATCH) pares.push({ ocr: i, ped: j, score });
    });
  });
  pares.sort((a, b) => b.score - a.score);
  const ocrUsada = new Set<number>();
  const pedUsada = new Set<number>();
  const asignacion = new Map<number, number>(); // ped -> ocr
  for (const p of pares) {
    if (ocrUsada.has(p.ocr) || pedUsada.has(p.ped)) continue;
    ocrUsada.add(p.ocr);
    pedUsada.add(p.ped);
    asignacion.set(p.ped, p.ocr);
  }

  const lineas: LineaAnalisis[] = [];
  let coincidencias = 0;
  let diferencias = 0;
  let extras = 0;
  let faltantes = 0;

  lineasPedido.forEach((lp, j) => {
    const i = asignacion.get(j);
    if (i === undefined) {
      faltantes++;
      lineas.push({
        productoProveedor: "",
        cantidadProveedor: 0,
        precioProveedor: 0,
        unidadProveedor: "",
        productoInterno: lp.producto,
        cantidadInterna: lp.cantidad,
        precioInterno: lp.precioUC,
        tipo: "faltante",
      });
      return;
    }
    const lo = lineasOcr[i];
    const cantidadDifiere = Math.abs(lo.cantidad - lp.cantidad) > TOLERANCIA_CANTIDAD;
    const precioDifiere =
      lo.precioUnitario != null && Math.abs(lo.precioUnitario - lp.precioUC) > TOLERANCIA_PRECIO;
    const tipo: LineaAnalisis["tipo"] =
      cantidadDifiere && precioDifiere
        ? "cantidad_y_precio"
        : cantidadDifiere
          ? "cantidad_diferente"
          : precioDifiere
            ? "precio_diferente"
            : "coincide";
    if (tipo === "coincide") coincidencias++;
    else diferencias++;
    lineas.push({
      productoProveedor: lo.nombre,
      cantidadProveedor: lo.cantidad,
      precioProveedor: lo.precioUnitario ?? 0,
      unidadProveedor: lo.unidad || "",
      productoInterno: lp.producto,
      cantidadInterna: lp.cantidad,
      precioInterno: lp.precioUC,
      tipo,
    });
  });

  lineasOcr.forEach((lo, i) => {
    if (ocrUsada.has(i)) return;
    extras++;
    lineas.push({
      productoProveedor: lo.nombre,
      cantidadProveedor: lo.cantidad,
      precioProveedor: lo.precioUnitario ?? 0,
      unidadProveedor: lo.unidad || "",
      productoInterno: null,
      cantidadInterna: 0,
      precioInterno: 0,
      tipo: "extra",
    });
  });

  return {
    datosAlbaran: {
      proveedor: cabecera.proveedor ?? "",
      numero: cabecera.numero ?? "",
      fecha: cabecera.fecha ?? "",
    },
    lineas,
    resumen: {
      totalLineas: lineas.length,
      coincidencias,
      diferencias,
      extras,
      faltantes,
      hayAlerta: diferencias + extras + faltantes > 0,
    },
  };
}
