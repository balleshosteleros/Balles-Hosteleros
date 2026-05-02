import * as XLSX from "xlsx";
import type { ColumnDef } from "../types";
import { normalizeHeader } from "./format";

export interface ReadOptions {
  sheetName?: string;
}

export async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, { type: "array", cellDates: true });
}

export function readRows(
  workbook: XLSX.WorkBook,
  options: ReadOptions = {}
): Record<string, unknown>[] {
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

export function downloadWorkbook(sheets: SheetSpec[], filename: string): void {
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

export function downloadCSV(rows: (string | number | boolean | null | undefined)[][], filename: string): void {
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
