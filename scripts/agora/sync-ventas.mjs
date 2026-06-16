// Ingesta de ventas de Ágora POS → pos_tickets / pos_ticket_lineas (PRP-056).
// - Idempotente: numero = "AG-{serie}-{numero}" sobre el único (empresa_id, numero).
//   Al reprocesar un día se REEMPLAZAN las líneas del ticket.
// - Ingiere TODAS las facturas (también importe 0 o negativo = devoluciones/abonos).
// - total del ticket = Invoice.Totals.GrossAmount (autoritativo; evita doblar menús).
// - Registra una fila por (empresa, día) en agora_sync_log.
// Uso:
//   node scripts/agora/sync-ventas.mjs                       (dry-run, ayer)
//   node scripts/agora/sync-ventas.mjs --from 2026-06-01 --to 2026-06-09 --write
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const getArg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };

function loadEnv() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) throw new Error(".env.local no encontrado");
  for (const line of readFileSync(p, "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BASE = (process.env.AGORA_API_URL || "http://habanabacanaliictpv.ddns.me:8984").replace(/\/$/, "");
const TOKEN = process.env.AGORA_API_TOKEN;
const agoraGet = async (p) => { const r = await fetch(BASE + p, { headers: { "Api-Token": TOKEN, Accept: "application/json" } }); if (!r.ok) throw new Error(`Ágora ${p} -> HTTP ${r.status}`); return r.json(); };

const EMP = {
  4: { nombre: "BACANAL", empresaId: "fe2ea3c4-aa28-41ce-a135-bf196ab5dc47" },
  1: { nombre: "HABANA", empresaId: "00000000-0000-0000-0000-000000000001" },
};
const toNum = (v) => { if (v == null) return 0; const n = typeof v === "number" ? v : Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : 0; };

function rangoDias(from, to) {
  const out = []; const d = new Date(from + "T00:00:00Z"); const end = new Date(to + "T00:00:00Z");
  while (d <= end) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}

// Mapa (empresaId|agora_id) -> { venta, any } para resolver producto_id (prefiere venta)
async function cargarMapaProductos() {
  const map = new Map();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("productos").select("id, empresa_id, agora_id, tipo").not("agora_id", "is", null).range(from, from + 999);
    if (error) throw error;
    for (const p of data) {
      const k = `${p.empresa_id}|${p.agora_id}`;
      const cur = map.get(k) || { venta: null, any: null };
      if (p.tipo === "venta") cur.venta = p.id;
      cur.any = cur.any || p.id;
      map.set(k, cur);
    }
    if (data.length < 1000) break;
  }
  return map;
}
const resolverProducto = (map, empresaId, agoraId) => { const e = map.get(`${empresaId}|${agoraId}`); return e ? (e.venta || e.any) : null; };

async function ingerirDiaEmpresa(dia, wpId, invoices, prodMap) {
  const { empresaId, nombre } = EMP[wpId];
  const propias = invoices.filter((f) => f.Workplace?.Id === wpId);
  if (propias.length === 0) return { empresaId, dia, facturas: 0, lineas: 0, sinMatch: 0 };

  // 1) Tickets
  const ticketRows = propias.map((f) => {
    const items = f.InvoiceItems || [];
    const comensales = items.reduce((a, it) => a + (it.Guests || 0), 0) || 1;
    const t = f.Totals || {};
    return {
      empresa_id: empresaId,
      numero: `AG-${f.Serie}-${f.Number}`,
      origen: "agora",
      agora_serie: String(f.Serie),
      agora_numero: f.Number,
      estado: "COBRADO",
      comensales,
      subtotal: toNum(t.NetAmount),
      iva_total: toNum(t.VatAmount),
      total: toNum(t.GrossAmount),
      abierto_at: f.Date,
      // cerrado_at = business-day (a mediodía) para que Ventas agrupe por jornada de
      // Ágora, no por fecha natural (un club vende de madrugada = jornada anterior).
      cerrado_at: `${f.BusinessDay}T12:00:00`,
      stock_descontado: true,
      notas: `Ágora ${f.Serie}-${f.Number}`,
    };
  });

  if (!WRITE) {
    const lineasN = propias.reduce((a, f) => a + (f.InvoiceItems || []).reduce((b, it) => b + (it.Lines || []).length, 0), 0);
    return { empresaId, dia, facturas: ticketRows.length, lineas: lineasN, sinMatch: 0, dryRun: true };
  }

  const { data: tickets, error: e1 } = await sb.from("pos_tickets").upsert(ticketRows, { onConflict: "empresa_id,numero" }).select("id, numero");
  if (e1) throw e1;
  const idPorNumero = new Map(tickets.map((t) => [t.numero, t.id]));
  const ticketIds = tickets.map((t) => t.id);

  // 2) Reemplazar líneas: borrar las existentes de esos tickets
  for (let i = 0; i < ticketIds.length; i += 200) {
    const { error } = await sb.from("pos_ticket_lineas").delete().in("ticket_id", ticketIds.slice(i, i + 200));
    if (error) throw error;
  }

  // 3) Insertar líneas
  let sinMatch = 0;
  const lineaRows = [];
  for (const f of propias) {
    const ticketId = idPorNumero.get(`AG-${f.Serie}-${f.Number}`);
    for (const it of f.InvoiceItems || []) {
      for (const ln of it.Lines || []) {
        if (!ln.ProductId && ln.ProductId !== 0) continue;
        const pid = resolverProducto(prodMap, empresaId, String(ln.ProductId));
        if (!pid) sinMatch++;
        lineaRows.push({
          ticket_id: ticketId,
          producto_id: pid,
          nombre: ln.ProductName || `Ágora ${ln.ProductId}`,
          cantidad: toNum(ln.Quantity),
          precio_unitario: toNum(ln.UnitPrice),
          iva_pct: Math.round(toNum(ln.VatRate) * 100),
          descuento_pct: Math.round(toNum(ln.DiscountRate) * 100),
        });
      }
    }
  }
  for (let i = 0; i < lineaRows.length; i += 500) {
    const { error } = await sb.from("pos_ticket_lineas").insert(lineaRows.slice(i, i + 500));
    if (error) throw error;
  }
  return { empresaId, dia, facturas: ticketRows.length, lineas: lineaRows.length, sinMatch };
}

async function main() {
  const to = getArg("--to") || new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const from = getArg("--from") || to;
  const dias = rangoDias(from, to);
  console.log(`${WRITE ? "ESCRIBIENDO" : "DRY-RUN"} · ${from} → ${to} (${dias.length} días)`);
  const prodMap = WRITE ? await cargarMapaProductos() : new Map();
  let totFact = 0, totLin = 0, totSinMatch = 0;
  for (const dia of dias) {
    let invoices;
    try { invoices = (await agoraGet(`/api/export/?business-day=${dia}&filter=Invoices`)).Invoices || []; }
    catch (err) { console.error(`  ${dia}: ERROR Ágora ${err.message}`); continue; }
    for (const wpId of Object.keys(EMP).map(Number)) {
      const r = await ingerirDiaEmpresa(dia, wpId, invoices, prodMap);
      if (r.facturas === 0) continue;
      totFact += r.facturas; totLin += r.lineas; totSinMatch += r.sinMatch;
      if (WRITE) {
        await sb.from("agora_sync_log").insert({
          empresa_id: r.empresaId, status: "ok", total_records: r.facturas, ok_records: r.facturas, error_records: 0,
          sales_data: { dia, facturas: r.facturas, lineas: r.lineas, lineas_sin_producto: r.sinMatch },
        });
      }
      console.log(`  ${dia} ${EMP[wpId].nombre}: ${r.facturas} facturas · ${r.lineas} líneas${r.sinMatch ? ` · ${r.sinMatch} sin producto` : ""}${r.dryRun ? " (dry)" : ""}`);
    }
  }
  console.log(`\nTOTAL: ${totFact} facturas · ${totLin} líneas · ${totSinMatch} líneas sin producto`);
  if (!WRITE) console.log("*** DRY-RUN — usa --write para escribir ***");
}
main().catch((e) => { console.error("FALLO:", e.message); process.exit(1); });
