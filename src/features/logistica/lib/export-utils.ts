import * as XLSX from "xlsx";

type Row = Record<string, unknown>;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToCSV(rows: Row[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    headers.map(esc).join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ];
  downloadBlob(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" }), filename);
}

export function exportToXLSX(rows: Row[], filename: string) {
  if (rows.length === 0) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Datos");
  XLSX.writeFile(wb, filename);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[c] ?? c;
  });
}

export function exportToPDF(rows: Row[], filename: string, title?: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const docTitle = title ?? filename.replace(/\.[^.]+$/, "");
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
  <span class="meta">${rows.length} registro${rows.length === 1 ? "" : "s"} · ${new Date().toLocaleDateString("es-ES")}</span>
</header>
<table>
  <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
  <tbody>${rows
    .map((r) => `<tr>${headers.map((h) => `<td>${escapeHtml(String(r[h] ?? ""))}</td>`).join("")}</tr>`)
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

  // Popup bloqueado — fallback a iframe oculto
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
