import type { ModuleIO } from "../types";
import { downloadCSV, downloadJSON, downloadWorkbook, type SheetSpec } from "./xlsx";
import { formatArray, formatBoolean, formatDate } from "./format";

export function buildTemplateSheets<T>(config: ModuleIO<T>): SheetSpec[] {
  const visibleCols = config.columns.filter((c) => !c.hideInImport);

  const headers = visibleCols.map((c) => c.label);
  const exampleRow = visibleCols.map((c) => c.example ?? "");
  const data: SheetSpec = {
    name: "Datos",
    rows: [headers, exampleRow],
    columnWidths: headers.map((h) => Math.max(14, h.length + 4)),
  };

  const instructionsRows: (string | number | boolean | null | undefined)[][] = [
    [config.label],
    [config.description ?? ""],
    [],
    ["Columna", "Obligatoria", "Tipo", "Descripción / valores"],
  ];
  for (const c of visibleCols) {
    instructionsRows.push([
      c.label,
      c.required ? "Sí" : "",
      c.type ?? "string",
      c.description ?? c.values?.join(", ") ?? "",
    ]);
  }
  instructionsRows.push(
    [],
    ["Notas de formato:"],
    ["Fechas", "DD/MM/YYYY o YYYY-MM-DD"],
    ["Números", "Punto decimal (no separador de miles)"],
    ["Booleanos", "Sí / No"],
    ["Listas", "Valores separados por coma o punto y coma"],
  );
  const instructions: SheetSpec = {
    name: "Instrucciones",
    rows: instructionsRows,
    columnWidths: [28, 12, 12, 60],
  };

  const sheets: SheetSpec[] = [data, instructions];

  const enumCols = visibleCols.filter((c) => c.type === "enum" && c.values?.length);
  if (enumCols.length > 0) {
    const dictRows: (string | number | boolean | null | undefined)[][] = [
      ["Columna", "Valores válidos"],
    ];
    for (const c of enumCols) {
      dictRows.push([c.label, (c.values ?? []).join(" | ")]);
    }
    sheets.push({ name: "Diccionario", rows: dictRows, columnWidths: [28, 60] });
  }

  return sheets;
}

export function downloadTemplate<T>(config: ModuleIO<T>, format: "xlsx" | "csv" = "xlsx"): void {
  const filename = `plantilla-${config.submodule}.${format}`;
  if (format === "csv") {
    const headers = config.columns.filter((c) => !c.hideInImport).map((c) => c.label);
    const example = config.columns.filter((c) => !c.hideInImport).map((c) => c.example ?? "");
    downloadCSV([headers, example], filename);
    return;
  }
  downloadWorkbook(buildTemplateSheets(config), filename);
}

export function buildExportRows<T>(
  config: ModuleIO<T>,
  records: T[]
): (string | number | boolean | null | undefined)[][] {
  const visibleCols = config.columns.filter((c) => !c.hideInExport);
  const headers = visibleCols.map((c) => c.label);
  const rows: (string | number | boolean | null | undefined)[][] = [headers];
  for (const record of records) {
    const row: (string | number | boolean | null | undefined)[] = [];
    for (const c of visibleCols) {
      const raw = (record as Record<string, unknown>)[c.key];
      row.push(formatCellValue(raw, c.type));
    }
    rows.push(row);
  }
  return rows;
}

function formatCellValue(
  raw: unknown,
  type?: string
): string | number | boolean | null | undefined {
  if (raw === null || raw === undefined) return "";
  if (type === "boolean") return formatBoolean(raw);
  if (type === "date") return formatDate(raw);
  if (type === "array") return formatArray(raw);
  if (type === "number" && typeof raw === "number") return raw;
  return typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean"
    ? raw
    : String(raw);
}

export async function downloadExport<T>(
  config: ModuleIO<T>,
  records: T[],
  format: "xlsx" | "csv" | "json"
): Promise<void> {
  const ts = new Date().toISOString().slice(0, 10);
  const base = `${config.submodule}-${ts}`;

  if (format === "json") {
    downloadJSON({ module: config.module, submodule: config.submodule, records }, `${base}.json`);
    return;
  }

  const rows = buildExportRows(config, records);
  if (format === "csv") {
    downloadCSV(rows, `${base}.csv`);
    return;
  }
  downloadWorkbook([{ name: "Datos", rows }], `${base}.xlsx`);
}
