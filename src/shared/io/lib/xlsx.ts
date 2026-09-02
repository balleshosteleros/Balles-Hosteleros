import type * as XLSXTypes from "xlsx";
import type { ColumnDef } from "../types";
import { normalizeHeader } from "./format";

/**
 * `xlsx` pesa ~200 KB y solo hace falta cuando alguien importa o exporta un
 * Excel. Importada arriba de forma normal, viajaba en el arranque de TODAS las
 * pantallas con barra de herramientas — Reservas incluida, que ni siquiera la
 * ofrece. Se carga la primera vez que se usa de verdad, y el navegador la
 * guarda para las siguientes.
 */
let xlsxPromesa: Promise<typeof XLSXTypes> | null = null;
function cargarXLSX(): Promise<typeof XLSXTypes> {
  xlsxPromesa ??= import("xlsx");
  return xlsxPromesa;
}

export interface ReadOptions {
  sheetName?: string;
}

export async function readWorkbook(file: File): Promise<XLSXTypes.WorkBook> {
  const [XLSX, buffer] = await Promise.all([cargarXLSX(), file.arrayBuffer()]);
  return XLSX.read(buffer, { type: "array", cellDates: true });
}

export async function readRows(
  workbook: XLSXTypes.WorkBook,
  options: ReadOptions = {}
): Promise<Record<string, unknown>[]> {
  const XLSX = await cargarXLSX();
  const sheetName =
    options.sheetName && workbook.Sheets[options.sheetName]
      ? options.sheetName
      : workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
    blankrows: false,
  });
  return rows.map(normalizeRowKeys);
}

function normalizeRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[normalizeHeader(key)] = value;
  }
  return out;
}

export function buildColumnLookup<T>(columns: ColumnDef<T>[]): Map<string, ColumnDef<T>> {
  const map = new Map<string, ColumnDef<T>>();
  for (const col of columns) {
    if (col.hideInImport) continue;
    map.set(normalizeHeader(col.label), col);
    map.set(normalizeHeader(col.key), col);
    for (const alias of col.aliases ?? []) {
      map.set(normalizeHeader(alias), col);
    }
  }
  return map;
}

export interface SheetSpec {
  name: string;
  rows: (string | number | boolean | null | undefined)[][];
  columnWidths?: number[];
}

export async function downloadWorkbook(sheets: SheetSpec[], filename: string): Promise<void> {
  const XLSX = await cargarXLSX();
  const wb = XLSX.utils.book_new();
  for (const spec of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(spec.rows);
    if (spec.columnWidths) {
      ws["!cols"] = spec.columnWidths.map((wch) => ({ wch }));
    }
    XLSX.utils.book_append_sheet(wb, ws, spec.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename, { compression: true });
}

export async function downloadCSV(rows: (string | number | boolean | null | undefined)[][], filename: string): Promise<void> {
  const XLSX = await cargarXLSX();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";" });
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  triggerBlobDownload(blob, filename);
}

export function downloadJSON(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  triggerBlobDownload(blob, filename);
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
