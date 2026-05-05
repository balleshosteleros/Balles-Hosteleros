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
  format: "xlsx" | "csv" | "json" | "pdf"
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
  if (format === "pdf") {
    printRowsAsPDF(rows, `${base}.pdf`, config.label);
    return;
  }
  downloadWorkbook([{ name: "Datos", rows }], `${base}.xlsx`);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[c] ?? c;
  });
}

function printRowsAsPDF(
  rows: (string | number | boolean | null | undefined)[][],
  filename: string,
  title: string,
): void {
  if (rows.length === 0) return;
  const [headers, ...body] = rows;
  const docTitle = title || filename.replace(/\.[^.]+$/, "");
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(docTitle)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font: 10pt -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #111; margin: 0; padding: 0; }
  header { display: flex; justify-content: space-between; align-items: baseline; margin: 0 0 6mm 0; padding-bottom: 3mm; border-bottom: 2px solid #1e3a8a; }
  h1 { font-size: 13pt; margin: 0; color: #1e3a8a; }
  .meta { font-size: 8pt; color: #6b7280; }
  table { width: 100%; border-collapse: collapse; }
  thead { background: #f3f4f6; }
  th, td { border: 1px solid #e5e7eb; padding: 5px 7px; text-align: left; vertical-align: top; word-break: break-word; }
  th { font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.03em; color: #374151; font-weight: 600; }
  td { font-size: 9pt; }
  tr { page-break-inside: avoid; }
  tbody tr:nth-child(even) { background: #fafafa; }
</style></head><body>
<header>
  <h1>${escapeHtml(docTitle)}</h1>
  <span class="meta">${body.length} registro${body.length === 1 ? "" : "s"} · ${new Date().toLocaleDateString("es-ES")}</span>
</header>
<table>
  <thead><tr>${headers.map((h) => `<th>${escapeHtml(String(h ?? ""))}</th>`).join("")}</tr></thead>
  <tbody>${body
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(String(c ?? ""))}</td>`).join("")}</tr>`)
    .join("")}</tbody>
</table>
<script>window.addEventListener("load",function(){setTimeout(function(){window.focus();window.print();},150);});</script>
</body></html>`;

  const w = window.open("", "_blank", "width=1024,height=768");
  if (w) {
    w.document.open();
    w.document.write(html);
    w.document.close();
    return;
  }
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open();
  doc.write(html);
  doc.close();
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1500);
  };
}
