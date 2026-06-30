/**
 * Parser del Excel de fichas técnicas de producto (BACANAL).
 * PRP-071 — Fase 1.
 *
 * Layout posicional verificado de cada hoja (1 hoja = 1 plato):
 *   fila 1  colA  → nombre del plato
 *   fila 5  colC  → categoría de venta (colG fila5 = "DELICATESES HABANA" → IGNORAR)
 *   cabecera ingredientes: colG = "INGREDIENTES", colJ = "UNIDAD", colK = "CANTIDAD"
 *   ingredientes: desde la fila de cabecera +1 (hay fila vacía intermedia, se tolera);
 *                 colG = nombre, colJ = unidad, colK = cantidad
 *   fin de ingredientes: fila con texto en colA (otra sección: PARTIDA/ELABORACION…) o "TOTAL"
 *   fila 17 colA = "PARTIDA"; fila 19 colA = "ELABORACION", colD = texto
 *
 * No usa el wrapper compartido (shared/io) porque ese lee por cabeceras; aquí
 * la lectura es por coordenadas (header:1).
 */

import * as XLSX from "xlsx";
import type { FichaParsed, IngredienteParsed, ParseResult } from "./types";

// Índices de columna (0-based): A=0 … G=6 J=9 K=10
const COL_A = 0;
const COL_C = 2;
const COL_D = 3;
const COL_G = 6;
const COL_J = 9;
const COL_K = 10;

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Localiza el índice de fila de la cabecera "INGREDIENTES" (col G). */
function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < rows.length; i++) {
    if (str(rows[i]?.[COL_G]).toUpperCase().includes("INGREDIENTE")) return i;
  }
  return -1;
}

/** Busca el valor de col A que sigue a una etiqueta dada (p. ej. "ELABORACION" → su texto en col D). */
function findSectionText(rows: unknown[][], label: string, col: number): string | null {
  for (let i = 0; i < rows.length; i++) {
    if (str(rows[i]?.[COL_A]).toUpperCase().startsWith(label)) {
      const v = str(rows[i]?.[col]);
      return v || null;
    }
  }
  return null;
}

function parseSheet(hoja: string, sheet: XLSX.WorkSheet): FichaParsed | null {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  const plato = str(rows[1]?.[COL_A]) || hoja;
  const categoria = str(rows[5]?.[COL_C]) || null;

  const hdr = findHeaderRow(rows);
  if (hdr < 0) return null;

  const ingredientes: IngredienteParsed[] = [];
  for (let i = hdr + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const nombre = str(r[COL_G]);
    const up = nombre.toUpperCase();

    if (up.includes("TOTAL")) break;
    // Si empieza otra sección en col A (PARTIDA, ELABORACION…) y no hay ingrediente, terminamos.
    if (str(r[COL_A]) && !nombre) break;
    if (!nombre) continue; // hueco intermedio: seguir
    if (up === "UNIDAD" || up === "CANTIDAD" || up === "INGREDIENTES") continue;

    ingredientes.push({
      nombre,
      unidad: str(r[COL_J]),
      cantidad: num(r[COL_K]),
    });
  }

  if (ingredientes.length === 0) return null;

  return {
    plato,
    categoria,
    partida: findSectionText(rows, "PARTIDA", COL_C),
    elaboracion: findSectionText(rows, "ELABORACION", COL_D),
    ingredientes,
    hoja,
  };
}

/** Parsea un workbook ya leído. */
export function parseWorkbook(wb: XLSX.WorkBook): ParseResult {
  const fichas: FichaParsed[] = [];
  const saltadas: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) {
      saltadas.push(sheetName);
      continue;
    }
    const ficha = parseSheet(sheetName, sheet);
    if (ficha) fichas.push(ficha);
    else saltadas.push(sheetName);
  }
  return { fichas, saltadas };
}

/** Lee un File (navegador) y lo parsea. */
export async function parseFichasFile(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  return parseWorkbook(wb);
}

/** Lee un buffer/ruta (Node, para scripts de verificación) y lo parsea. */
export function parseFichasBuffer(data: ArrayBuffer | Uint8Array): ParseResult {
  const wb = XLSX.read(data, { type: "array" });
  return parseWorkbook(wb);
}
