// Inspecciona la estructura cruda de una factura de Ágora para entender los formatos de venta.
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
function loadEnv() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) throw new Error(".env.local no encontrado");
  for (const line of readFileSync(p, "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();
const BASE = (process.env.AGORA_API_URL || "http://habanabacanaliictpv.ddns.me:8984").replace(/\/$/, "");
const TOKEN = process.env.AGORA_API_TOKEN;
const dia = process.argv[2] || "2026-06-07";
const r = await fetch(`${BASE}/api/export/?business-day=${dia}&filter=Invoices`, { headers: { "Api-Token": TOKEN, Accept: "application/json" } });
if (!r.ok) { console.error("HTTP", r.status); process.exit(1); }
const data = await r.json();
const invs = data.Invoices ?? [];
console.log(`Facturas: ${invs.length}`);
// Buscar una línea de Jaggermeister (ProductId 1282) o la primera línea con datos
let muestraLinea = null, muestraFactura = null;
for (const f of invs) {
  for (const it of f.InvoiceItems ?? []) {
    for (const ln of it.Lines ?? []) {
      if (!muestraLinea) muestraLinea = ln;
      if (String(ln.ProductId) === "1282" || (ln.ProductName || "").toLowerCase().includes("jager") || (ln.ProductName || "").toLowerCase().includes("jagger")) {
        muestraLinea = ln; muestraFactura = f; break;
      }
    }
    if (muestraFactura) break;
  }
  if (muestraFactura) break;
}
console.log("\n=== CLAVES de una línea ===");
console.log(Object.keys(muestraLinea ?? {}));
console.log("\n=== Línea Jaggermeister (o primera) completa ===");
console.log(JSON.stringify(muestraLinea, null, 2));
console.log("\n=== Claves de InvoiceItem ===");
const it0 = invs[0]?.InvoiceItems?.[0];
console.log(Object.keys(it0 ?? {}));
