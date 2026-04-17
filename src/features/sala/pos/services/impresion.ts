/**
 * Servicio de impresión POS.
 *
 * Dos implementaciones:
 *   - `imprimirHTML`  → abre `window.print()` con el HTML 80mm (fallback universal).
 *   - `imprimirQZTray` → pendiente (integración con QZ Tray en cliente).
 *
 * En Fase 7 se implementa sólo el fallback HTML. QZ Tray se puede añadir en una
 * fase posterior sin tocar las llamadas (misma interfaz `Impresora`).
 */

import type { TicketLinea, TotalesTicket, LineaDestino } from "../types";
import { formatEur } from "./calculo-ticket";

// ─── HTML base para ticket 80mm ───────────────────────────────

interface HeaderInfo {
  empresa?: string;
  mesa?: string | null;
  camarero?: string | null;
  numero?: string;
  comensales?: number;
}

function envoltorioTicket(titulo: string, body: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${titulo}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  html, body { width: 72mm; font-family: 'Courier New', monospace; font-size: 11px; color: #000; margin: 0; padding: 0; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .sep { border-top: 1px dashed #000; margin: 4px 0; }
  .grid { display: grid; grid-template-columns: auto 1fr auto; gap: 4px; }
  .big { font-size: 14px; }
  .huge { font-size: 18px; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; }
  .nowrap { white-space: nowrap; }
  @media print {
    body { width: 72mm; }
  }
</style>
</head><body>${body}</body></html>`;
}

function htmlCabecera(h: HeaderInfo): string {
  return `
<div class="center bold big">${escape(h.empresa ?? "Balles Hosteleros")}</div>
<div class="center">${new Date().toLocaleString("es-ES")}</div>
${h.numero ? `<div class="center">Ticket ${escape(h.numero)}</div>` : ""}
${h.mesa ? `<div class="center">${escape(h.mesa)}</div>` : ""}
${h.camarero ? `<div>Camarero: ${escape(h.camarero)}</div>` : ""}
${h.comensales ? `<div>Comensales: ${h.comensales}</div>` : ""}
<div class="sep"></div>`;
}

function escape(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c
  );
}

// ─── TICKET DE VENTA ─────────────────────────────────────────

export function htmlTicketVenta(
  lineas: TicketLinea[],
  totales: TotalesTicket,
  header: HeaderInfo
): string {
  const filas = lineas
    .map(
      (l) => `<tr>
      <td class="nowrap">${l.cantidad.toFixed(l.cantidad % 1 === 0 ? 0 : 2)}</td>
      <td>${escape(l.nombre)}${l.notaCocina ? `<br/><small>· ${escape(l.notaCocina)}</small>` : ""}</td>
      <td class="right nowrap">${formatEur(l.cantidad * l.precioUnitario * (1 - l.descuentoPct / 100))}</td>
    </tr>`
    )
    .join("");

  const ivas = Object.entries(totales.ivaDesglosado)
    .map(([pct, imp]) => `<div>IVA ${pct}% .......... ${formatEur(imp)}</div>`)
    .join("");

  const body = `
${htmlCabecera(header)}
<table>${filas}</table>
<div class="sep"></div>
<div>Base ......... ${formatEur(totales.baseImponible)}</div>
${ivas}
${totales.descuento > 0 ? `<div>Descuento ... −${formatEur(totales.descuento)}</div>` : ""}
<div class="sep"></div>
<div class="bold huge center">TOTAL ${formatEur(totales.total)}</div>
<div class="sep"></div>
<div class="center">Gracias por su visita</div>
`;
  return envoltorioTicket("Ticket", body);
}

// ─── TICKET DE COMANDA (cocina / barra) ──────────────────────

export function htmlComanda(
  destino: LineaDestino,
  lineas: TicketLinea[],
  header: HeaderInfo
): string {
  const filas = lineas
    .filter((l) => l.destino === destino)
    .map(
      (l) => `<tr>
      <td class="nowrap bold big">${l.cantidad.toFixed(l.cantidad % 1 === 0 ? 0 : 2)}</td>
      <td class="bold big">${escape(l.nombre)}${l.notaCocina ? `<br/><small>· ${escape(l.notaCocina)}</small>` : ""}</td>
    </tr>`
    )
    .join("");

  if (!filas) return ""; // nada que imprimir

  const body = `
<div class="center bold big">COMANDA · ${destino}</div>
${htmlCabecera({ ...header, empresa: undefined })}
<table>${filas}</table>
<div class="sep"></div>
`;
  return envoltorioTicket(`Comanda ${destino}`, body);
}

// ─── EJECUTAR IMPRESIÓN (cliente) ────────────────────────────

export function imprimirHTML(html: string) {
  if (typeof window === "undefined") return;
  const w = window.open("", "pos_print", "width=400,height=600");
  if (!w) {
    console.warn("[pos][impresion] Ventana emergente bloqueada.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Pequeño delay para asegurar render antes de llamar a print
  setTimeout(() => {
    w.focus();
    w.print();
    w.close();
  }, 300);
}
