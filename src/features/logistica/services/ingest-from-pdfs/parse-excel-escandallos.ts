/**
 * Parser del Excel "FICHAS TECNICAS - PRODUCTO .xlsx".
 * Cada hoja es el escandallo de un plato con su escandallo.
 *
 * Estructura detectada de cada hoja:
 *   Fila 1:      Nombre del plato
 *   Fila 5 col C: Categoría de venta (PARA EMPEZAR, DE LA TIERRA, ...)
 *   Fila 17 col D: Partida (FRIO, FREIDORA Y PLANCHA, ...)
 *   Fila 41:     PVP (col H) y COSTE % (col K)
 *   Fila 43:     Cabeceras del escandallo
 *   Fila 45+:    Filas con [nombre, _, unidad, cantidad, precio, costeBruto, merma%, _, _, cantTotal, costeNeto]
 */

import * as XLSX from "xlsx";

export interface EscandalloParsed {
  plato: string;
  categoria: string;
  partida: string | null;
  pvp: number | null;
  costePct: number | null;
  ingredientes: IngredienteParsed[];
}

export interface IngredienteParsed {
  nombre: string;
  unidad: string;
  cantidad: number;
  precioUnitario: number;
  mermaPct: number;
  costeNeto: number;
}

function num(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return val;
  const s = String(val).replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function str(val: unknown): string {
  return String(val ?? "").trim();
}

/**
 * Parsea una hoja concreta y devuelve el escandallo estructurado.
 * Si la hoja no tiene sección de escandallo detallado (filas 45+), devuelve null.
 */
function parseSheet(sheetName: string, sheet: XLSX.WorkSheet): EscandalloParsed | null {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  // Nombre desde fila 1 (index 1 en el array porque tiene una fila vacía al inicio)
  // En realidad index 1 tiene el dato según lo observado
  const nombre = str(rows[1]?.[0]) || sheetName;

  // Categoría desde fila 5 col C (index 2)
  const categoria = str(rows[5]?.[2]) || "SIN CATEGORIA";

  // Partida desde fila 17 col D (index 3)
  const partida = str(rows[17]?.[3]) || null;

  // PVP y coste % de fila 41
  const pvp = num(rows[41]?.[7]);
  const costePct = num(rows[41]?.[10]);

  // Escandallo detallado empieza en fila 45 (index 45)
  const ingredientes: IngredienteParsed[] = [];
  for (let i = 45; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const nombreIng = str(r[0]);
    if (!nombreIng) break; // fin del escandallo

    const unidad = str(r[2]);
    const cantidad = num(r[3]);
    const precioUnitario = num(r[4]);
    const mermaPct = num(r[6]) ?? 0;
    const costeNeto = num(r[10]) ?? 0;

    if (!unidad || cantidad === null || precioUnitario === null) continue;

    ingredientes.push({
      nombre: nombreIng,
      unidad,
      cantidad,
      precioUnitario,
      mermaPct,
      costeNeto,
    });
  }

  if (ingredientes.length === 0) return null;

  return {
    plato: nombre,
    categoria,
    partida,
    pvp,
    costePct,
    ingredientes,
  };
}

/**
 * Lee el Excel completo y devuelve un escandallo por cada hoja válida.
 */
export function parseExcelEscandallos(filePath: string): {
  escandallos: EscandalloParsed[];
  saltadas: string[];
} {
  const wb = XLSX.readFile(filePath);
  const escandallos: EscandalloParsed[] = [];
  const saltadas: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const parsed = parseSheet(sheetName, sheet);
    if (parsed) escandallos.push(parsed);
    else saltadas.push(sheetName);
  }

  return { escandallos, saltadas };
}

/**
 * Deduplica ingredientes a nivel global (por nombre normalizado).
 * Devuelve un mapa: nombreNormalizado → { nombreOriginal, unidad, precioMedio }
 */
export function extractIngredientesUnicos(
  escandallos: EscandalloParsed[]
): Map<string, { nombre: string; unidad: string; precio: number }> {
  const map = new Map<string, { nombre: string; unidad: string; precio: number; count: number; sumaPrecio: number }>();

  for (const e of escandallos) {
    for (const ing of e.ingredientes) {
      const key = ing.nombre.toLowerCase().trim();
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        existing.sumaPrecio += ing.precioUnitario;
      } else {
        map.set(key, {
          nombre: ing.nombre.trim(),
          unidad: ing.unidad,
          precio: ing.precioUnitario,
          count: 1,
          sumaPrecio: ing.precioUnitario,
        });
      }
    }
  }

  // Convertir a precio medio
  const result = new Map<string, { nombre: string; unidad: string; precio: number }>();
  for (const [key, val] of map.entries()) {
    result.set(key, {
      nombre: val.nombre,
      unidad: val.unidad,
      precio: Math.round((val.sumaPrecio / val.count) * 100) / 100,
    });
  }
  return result;
}
