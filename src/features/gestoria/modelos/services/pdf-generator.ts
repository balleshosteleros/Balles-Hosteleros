/**
 * Generador HTML oficial imprimible (A4) para modelos AEAT.
 * El HTML se sirve con CSS de impresión; el navegador exporta a PDF.
 *
 * Formato fiel al oficial: cabecera AEAT, secciones con casillas numeradas,
 * fuente monospace para importes, estilo institucional.
 */
import type { CasillasMap, ModeloAeat, SnapshotEmpresa } from "../types/modelos";
import { periodoALabel } from "../types/modelos";

function fmt(n: number | undefined): string {
  if (n == null || n === 0) return "—";
  return n.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function styles(): string {
  return `
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #111; margin: 0; }
    .sheet { width: 180mm; margin: 0 auto; }
    header.aeat { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
    header.aeat .logo { font-weight: 800; font-size: 13px; letter-spacing: 3px; }
    header.aeat h1 { font-size: 16px; margin: 0; }
    header.aeat .periodo { font-size: 10px; text-align: right; }
    .empresa-box { border: 1px solid #000; padding: 6px; margin-bottom: 10px; background: #f5f5f5; }
    .empresa-box p { margin: 2px 0; font-size: 10px; }
    section { margin-bottom: 10px; }
    section h2 { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; background: #000; color: #fff; padding: 3px 6px; margin: 0; }
    section .content { border: 1px solid #000; border-top: none; padding: 6px 8px; }
    .fila { display: grid; grid-template-columns: 60px 1fr 100px 60px 100px; gap: 4px; border-bottom: 1px dotted #999; padding: 2px 0; align-items: center; }
    .fila .cas { font-family: 'Courier New', monospace; font-weight: 700; background: #fff3cd; padding: 2px 4px; border: 1px solid #000; text-align: center; }
    .fila .imp { text-align: right; font-family: 'Courier New', monospace; font-weight: 600; border-bottom: 1px solid #666; padding: 2px 4px; }
    .fila .label { font-size: 10px; }
    .resultado { background: #d1ecf1; border: 2px solid #0c5460; padding: 4px 8px; margin-top: 6px; }
    .resultado .fila .imp { font-weight: 800; font-size: 13px; }
    footer.aeat { margin-top: 10px; padding-top: 4px; border-top: 1px solid #000; font-size: 9px; text-align: center; color: #555; }
    .hash { font-family: 'Courier New', monospace; font-size: 8px; color: #777; word-break: break-all; }
    table.reg347 { width: 100%; border-collapse: collapse; font-size: 10px; }
    table.reg347 th, table.reg347 td { border: 1px solid #000; padding: 2px 4px; }
    table.reg347 th { background: #e9e9e9; }
    table.reg347 td.num { text-align: right; font-family: 'Courier New', monospace; }
    @media print { .no-print { display: none !important; } }
    .print-btn { position: fixed; top: 10px; right: 10px; padding: 8px 16px; background: #0c5460; color: #fff; border: 0; border-radius: 4px; cursor: pointer; font-weight: 700; }
  `;
}

function cabecera(tipo: string, titulo: string, modelo: ModeloAeat, snapshot: SnapshotEmpresa): string {
  return `
    <header class="aeat">
      <div>
        <div class="logo">AEAT · AGENCIA TRIBUTARIA</div>
        <h1>Modelo ${tipo} · ${titulo}</h1>
      </div>
      <div class="periodo">
        <p><strong>Ejercicio:</strong> ${modelo.ejercicio}</p>
        <p><strong>Periodo:</strong> ${periodoALabel(modelo.periodo, modelo.ejercicio)}</p>
        <p><strong>Estado:</strong> ${modelo.estado}</p>
      </div>
    </header>
    <div class="empresa-box">
      <p><strong>${snapshot.razon_social}</strong></p>
      <p>NIF: ${snapshot.nif}</p>
      ${snapshot.direccion ? `<p>${snapshot.direccion}</p>` : ""}
      ${snapshot.epigrafe_iae ? `<p>IAE: ${snapshot.epigrafe_iae}</p>` : ""}
    </div>
  `;
}

function fila(casilla: string, label: string, valor: number | undefined, tipo = ""): string {
  return `<div class="fila"><span class="cas">${casilla}</span><span class="label">${label}</span><span class="imp">${fmt(valor)}${tipo ? ` <em>${tipo}</em>` : ""}</span><span></span><span></span></div>`;
}

export function generarHtml303(modelo: ModeloAeat, snapshot: SnapshotEmpresa): string {
  const c: CasillasMap = modelo.casillas ?? {};
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Modelo 303 · ${modelo.ejercicio}-${modelo.periodo}</title><style>${styles()}</style></head><body>
<button class="print-btn no-print" onclick="window.print()">Imprimir / Guardar PDF</button>
<div class="sheet">
${cabecera("303", "IVA · Autoliquidación", modelo, snapshot)}

<section><h2>IVA devengado · Régimen general</h2><div class="content">
${fila("01", "Base imponible 21 %", c["01"])}${fila("03", "Cuota 21 %", c["03"])}
${fila("04", "Base imponible 10 %", c["04"])}${fila("06", "Cuota 10 %", c["06"])}
${fila("07", "Base imponible 4 %", c["07"])}${fila("09", "Cuota 4 %", c["09"])}
</div></section>

<section><h2>Total cuota devengada</h2><div class="content">${fila("27", "Total cuota devengada", c["27"])}</div></section>

<section><h2>IVA deducible</h2><div class="content">
${fila("28", "Base operaciones interior bienes corrientes", c["28"])}${fila("29", "Cuota deducible", c["29"])}
${fila("30", "Base operaciones interior bienes inversión", c["30"])}${fila("31", "Cuota deducible", c["31"])}
${fila("32", "Base importaciones bienes corrientes", c["32"])}${fila("33", "Cuota deducible", c["33"])}
${fila("36", "Base adq. intracomunitarias", c["36"])}${fila("37", "Cuota deducible", c["37"])}
${fila("45", "Total cuotas a deducir", c["45"])}
</div></section>

<section><h2>Resultado</h2><div class="resultado content">
${fila("46", "Diferencia (27 − 45)", c["46"])}
${fila("64", "Resultado régimen general", c["64"])}
${fila("67", "Cuotas a compensar periodos anteriores", c["67"])}
${fila("69", "RESULTADO (64 − 67)", c["69"])}
${c["71"] ? fila("71", "A INGRESAR", c["71"]) : ""}
${c["72"] ? fila("72", "A COMPENSAR", c["72"]) : ""}
</div></section>

<footer class="aeat">
  Borrador generado por Balles-Hosteleros · ${new Date().toLocaleString("es-ES")}
  ${modelo.hash_snapshot ? `<div class="hash">Hash inmutable: ${modelo.hash_snapshot}</div>` : ""}
</footer>
</div></body></html>`;
}

export function generarHtml130(modelo: ModeloAeat, snapshot: SnapshotEmpresa): string {
  const c: CasillasMap = modelo.casillas ?? {};
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Modelo 130 · ${modelo.ejercicio}-${modelo.periodo}</title><style>${styles()}</style></head><body>
<button class="print-btn no-print" onclick="window.print()">Imprimir / Guardar PDF</button>
<div class="sheet">
${cabecera("130", "IRPF · Pago fraccionado · Estimación directa", modelo, snapshot)}
<section><h2>Actividad económica</h2><div class="content">
${fila("01", "Ingresos computables acumulados", c["01"])}
${fila("02", "Gastos deducibles acumulados", c["02"])}
${fila("03", "Rendimiento neto (01 − 02)", c["03"])}
${fila("04", "Porcentaje aplicable", c["04"] ?? 20, "%")}
${fila("07", "Pago fraccionado trimestre", c["07"])}
${fila("08", "Pagos trimestres anteriores", c["08"])}
${fila("06", "Retenciones soportadas", c["06"])}
${fila("19", "RESULTADO", c["19"])}
</div></section>
<footer class="aeat">
  Borrador generado por Balles-Hosteleros · ${new Date().toLocaleString("es-ES")}
  ${modelo.hash_snapshot ? `<div class="hash">Hash inmutable: ${modelo.hash_snapshot}</div>` : ""}
</footer>
</div></body></html>`;
}

export function generarHtml111(modelo: ModeloAeat, snapshot: SnapshotEmpresa): string {
  const c: CasillasMap = modelo.casillas ?? {};
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Modelo 111 · ${modelo.ejercicio}-${modelo.periodo}</title><style>${styles()}</style></head><body>
<button class="print-btn no-print" onclick="window.print()">Imprimir / Guardar PDF</button>
<div class="sheet">
${cabecera("111", "Retenciones IRPF · Trabajadores y profesionales", modelo, snapshot)}
<section><h2>I · Rendimientos del trabajo</h2><div class="content">
${fila("02", "Nº perceptores", c["02"])}
${fila("01", "Importe percepciones dinerarias", c["01"])}
${fila("03", "Retenciones dinerarias", c["03"])}
${fila("04", "Percepciones en especie", c["04"])}
${fila("06", "Ingresos a cuenta", c["06"])}
</div></section>
<section><h2>II · Rendimientos actividades profesionales</h2><div class="content">
${fila("08", "Nº perceptores", c["08"])}
${fila("07", "Importe", c["07"])}
${fila("09", "Retenciones", c["09"])}
</div></section>
<section><h2>Liquidación</h2><div class="resultado content">
${fila("25", "Total percepciones", c["25"])}
${fila("27", "Total retenciones", c["27"])}
${fila("28", "A INGRESAR", c["28"])}
</div></section>
<footer class="aeat">
  Borrador generado por Balles-Hosteleros · ${new Date().toLocaleString("es-ES")}
  ${modelo.hash_snapshot ? `<div class="hash">Hash inmutable: ${modelo.hash_snapshot}</div>` : ""}
</footer>
</div></body></html>`;
}

export function generarHtml115(modelo: ModeloAeat, snapshot: SnapshotEmpresa): string {
  const c: CasillasMap = modelo.casillas ?? {};
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Modelo 115 · ${modelo.ejercicio}-${modelo.periodo}</title><style>${styles()}</style></head><body>
<button class="print-btn no-print" onclick="window.print()">Imprimir / Guardar PDF</button>
<div class="sheet">
${cabecera("115", "Retenciones arrendamientos urbanos", modelo, snapshot)}
<section><h2>Liquidación</h2><div class="resultado content">
${fila("01", "Nº perceptores", c["01"])}
${fila("02", "Base de las retenciones", c["02"])}
${fila("03", "Importe retenciones (19%)", c["03"])}
${fila("06", "A INGRESAR", c["06"])}
</div></section>
<footer class="aeat">
  Borrador generado por Balles-Hosteleros · ${new Date().toLocaleString("es-ES")}
  ${modelo.hash_snapshot ? `<div class="hash">Hash inmutable: ${modelo.hash_snapshot}</div>` : ""}
</footer>
</div></body></html>`;
}

export function generarHtml390(modelo: ModeloAeat, snapshot: SnapshotEmpresa): string {
  const c: CasillasMap = modelo.casillas ?? {};
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Modelo 390 · ${modelo.ejercicio}</title><style>${styles()}</style></head><body>
<button class="print-btn no-print" onclick="window.print()">Imprimir / Guardar PDF</button>
<div class="sheet">
${cabecera("390", "IVA · Resumen anual", modelo, snapshot)}
<section><h2>IVA devengado · Régimen general</h2><div class="content">
${fila("100", "Base 21 %", c["100"])}${fila("101", "Cuota 21 %", c["101"])}
${fila("102", "Base 10 %", c["102"])}${fila("103", "Cuota 10 %", c["103"])}
${fila("104", "Base 4 %", c["104"])}${fila("105", "Cuota 4 %", c["105"])}
${fila("108", "Total bases", c["108"])}${fila("109", "Total cuotas", c["109"])}
</div></section>
<section><h2>IVA deducible</h2><div class="content">
${fila("190", "Interior bienes corrientes (base)", c["190"])}${fila("191", "Cuota", c["191"])}
${fila("192", "Bienes de inversión (base)", c["192"])}${fila("193", "Cuota", c["193"])}
${fila("597", "Total bases deducibles", c["597"])}${fila("598", "Total cuotas deducibles", c["598"])}
</div></section>
<section><h2>Resultado anual</h2><div class="resultado content">
${fila("599", "Régimen general devengado", c["599"])}
${fila("645", "Total cuotas deducibles", c["645"])}
${fila("658", "Liquidación anual", c["658"])}
${fila("660", "RESULTADO", c["660"])}
</div></section>
<footer class="aeat">
  Borrador generado por Balles-Hosteleros · ${new Date().toLocaleString("es-ES")}
  ${modelo.hash_snapshot ? `<div class="hash">Hash inmutable: ${modelo.hash_snapshot}</div>` : ""}
</footer>
</div></body></html>`;
}

export interface Registro347PDF {
  nif: string;
  nombre: string;
  clave: string;
  importe_t1: number;
  importe_t2: number;
  importe_t3: number;
  importe_t4: number;
  importe_total: number;
}

export function generarHtml347(
  modelo: ModeloAeat,
  snapshot: SnapshotEmpresa,
  registros: Registro347PDF[],
): string {
  const rows = registros
    .map(
      (r) => `<tr>
    <td>${r.nif}</td>
    <td>${r.nombre}</td>
    <td>${r.clave}</td>
    <td class="num">${fmt(r.importe_t1)}</td>
    <td class="num">${fmt(r.importe_t2)}</td>
    <td class="num">${fmt(r.importe_t3)}</td>
    <td class="num">${fmt(r.importe_t4)}</td>
    <td class="num"><strong>${fmt(r.importe_total)}</strong></td>
  </tr>`,
    )
    .join("\n");

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Modelo 347 · ${modelo.ejercicio}</title><style>${styles()}</style></head><body>
<button class="print-btn no-print" onclick="window.print()">Imprimir / Guardar PDF</button>
<div class="sheet">
${cabecera("347", "Operaciones con terceros", modelo, snapshot)}
<section><h2>Relación anual declarable (> 3.005,06 € IVA incluido)</h2><div class="content">
${
  registros.length === 0
    ? "<p><em>Ningún contacto supera el umbral. Nada que declarar.</em></p>"
    : `<table class="reg347">
  <thead><tr><th>NIF</th><th>Nombre</th><th>Clave</th><th>1T</th><th>2T</th><th>3T</th><th>4T</th><th>Total</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`
}
</div></section>
<footer class="aeat">
  Borrador generado por Balles-Hosteleros · ${new Date().toLocaleString("es-ES")}
  ${modelo.hash_snapshot ? `<div class="hash">Hash inmutable: ${modelo.hash_snapshot}</div>` : ""}
</footer>
</div></body></html>`;
}

export function generarHtmlModelo(
  modelo: ModeloAeat,
  snapshot: SnapshotEmpresa,
  registros347?: Registro347PDF[],
): string {
  switch (modelo.tipo) {
    case "303":
      return generarHtml303(modelo, snapshot);
    case "130":
      return generarHtml130(modelo, snapshot);
    case "111":
      return generarHtml111(modelo, snapshot);
    case "115":
      return generarHtml115(modelo, snapshot);
    case "390":
      return generarHtml390(modelo, snapshot);
    case "347":
      return generarHtml347(modelo, snapshot, registros347 ?? []);
    default:
      return "<html><body>Modelo no soportado</body></html>";
  }
}
