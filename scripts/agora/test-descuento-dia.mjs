// PRUEBA REAL del descuento de stock por ventas de un día (PRP-057).
// Replica fielmente el motor del código (kardex.ts + descontarStockPorTicket):
//   por cada línea vendida → expande la receta (producto_composicion) → por cada
//   ingrediente anota un movimiento 'salida' en stock_movimientos (con la factura)
//   y baja stock.cantidad_actual.
// Idempotente por (origen_linea_id, producto_id). Reversible con --revert.
//
// Uso:
//   node scripts/agora/test-descuento-dia.mjs --empresa <id> --dia 2026-06-09          (simulación)
//   node scripts/agora/test-descuento-dia.mjs --empresa <id> --dia 2026-06-09 --write  (aplica)
//   node scripts/agora/test-descuento-dia.mjs --empresa <id> --dia 2026-06-09 --revert (deshace)
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const REVERT = args.includes("--revert");
const getArg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const empresaId = getArg("--empresa");
const dia = getArg("--dia");
if (!empresaId || !dia) { console.error("uso: --empresa <id> --dia YYYY-MM-DD [--write|--revert]"); process.exit(1); }

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
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const eur = (n) => n.toFixed(2);

const { data: tickets } = await sb.from("pos_tickets")
  .select("id, numero, cerrado_at")
  .eq("empresa_id", empresaId).eq("origen", "agora")
  .gte("cerrado_at", `${dia}T00:00:00`).lte("cerrado_at", `${dia}T23:59:59`);
const ticketIds = (tickets ?? []).map((t) => t.id);
console.log(`\nDía ${dia} · empresa ${empresaId} · ${ticketIds.length} facturas`);
if (ticketIds.length === 0) process.exit(0);

// ─── REVERT ────────────────────────────────────────────────────────────────
if (REVERT) {
  let movs = [];
  for (let i = 0; i < ticketIds.length; i += 100) {
    const { data } = await sb.from("stock_movimientos").select("id, producto_id, cantidad, signo")
      .eq("empresa_id", empresaId).eq("documento_tipo", "pos_ticket").in("documento_id", ticketIds.slice(i, i + 100));
    movs = movs.concat(data ?? []);
  }
  console.log(`Revirtiendo ${movs.length} movimientos…`);
  for (const m of movs) {
    const { data: s } = await sb.from("stock").select("id, cantidad_actual").eq("empresa_id", empresaId).eq("producto_id", m.producto_id).maybeSingle();
    if (s) await sb.from("stock").update({ cantidad_actual: num(s.cantidad_actual) - m.signo * num(m.cantidad) }).eq("id", s.id);
  }
  for (let i = 0; i < ticketIds.length; i += 100) {
    await sb.from("stock_movimientos").delete().eq("documento_tipo", "pos_ticket").in("documento_id", ticketIds.slice(i, i + 100));
  }
  await sb.from("pos_tickets").update({ stock_descontado: false }).in("id", ticketIds);
  console.log("✓ Revertido. El stock vuelve a su valor anterior.\n");
  process.exit(0);
}

// ─── Cargar datos ────────────────────────────────────────────────────────────
const { data: lineas } = await sb.from("pos_ticket_lineas").select("id, ticket_id, producto_id, nombre, cantidad").in("ticket_id", ticketIds);
const lineasValidas = (lineas ?? []).filter((l) => l.producto_id);
const prodIds = [...new Set(lineasValidas.map((l) => l.producto_id))];
const tipoById = new Map();
for (let i = 0; i < prodIds.length; i += 200) {
  const { data } = await sb.from("productos").select("id, tipo").in("id", prodIds.slice(i, i + 200));
  for (const p of data ?? []) tipoById.set(p.id, p.tipo);
}
const ventaIds = prodIds.filter((id) => tipoById.get(id) === "venta");
const compByVenta = new Map();
for (let i = 0; i < ventaIds.length; i += 200) {
  const { data } = await sb.from("producto_composicion").select("producto_venta_id, ingrediente_id, cantidad, merma_pct").in("producto_venta_id", ventaIds.slice(i, i + 200));
  for (const c of data ?? []) { const a = compByVenta.get(c.producto_venta_id) ?? []; a.push(c); compByVenta.set(c.producto_venta_id, a); }
}
// stock en memoria
const stockByProd = new Map();
const { data: stockRows } = await sb.from("stock").select("id, producto_id, producto_nombre, cantidad_actual, unidad").eq("empresa_id", empresaId);
for (const s of stockRows ?? []) stockByProd.set(s.producto_id, { id: s.id, saldo: num(s.cantidad_actual), nombre: s.producto_nombre, unidad: s.unidad });
// nombres de ingredientes que falten
const nombreProd = new Map();
{ const { data } = await sb.from("productos").select("id, nombre, unidad").eq("empresa_id", empresaId); for (const p of data ?? []) nombreProd.set(p.id, p); }
// movimientos ya existentes (idempotencia)
const yaExiste = new Set();
for (let i = 0; i < ticketIds.length; i += 100) {
  const { data } = await sb.from("stock_movimientos").select("origen_linea_id, producto_id").eq("documento_tipo", "pos_ticket").in("documento_id", ticketIds.slice(i, i + 100));
  for (const m of data ?? []) yaExiste.add(`${m.origen_linea_id}|${m.producto_id}`);
}

const ticketById = new Map((tickets ?? []).map((t) => [t.id, t]));
const movimientos = [];
let omitidasSinReceta = 0;

for (const l of lineasValidas) {
  const t = ticketById.get(l.ticket_id);
  const cant = num(l.cantidad);
  const comp = compByVenta.get(l.producto_id);
  const ingredientes = comp && comp.length
    ? comp.map((c) => ({ id: c.ingrediente_id, consumo: cant * num(c.cantidad) * (1 + num(c.merma_pct) / 100) }))
    : tipoById.get(l.producto_id) === "compra" ? [{ id: l.producto_id, consumo: cant }] : null;
  if (!ingredientes) { omitidasSinReceta++; continue; }
  for (const ing of ingredientes) {
    if (ing.consumo <= 0) continue;
    if (yaExiste.has(`${l.id}|${ing.id}`)) continue;
    let st = stockByProd.get(ing.id);
    if (!st) { const p = nombreProd.get(ing.id); st = { id: null, saldo: 0, nombre: p?.nombre ?? "", unidad: p?.unidad ?? "ud" }; stockByProd.set(ing.id, st); }
    const antes = st.saldo;
    const despues = antes - ing.consumo;
    st.saldo = despues;
    movimientos.push({ productoId: ing.id, nombre: st.nombre, consumo: ing.consumo, antes, despues, factura: t?.numero, lineaId: l.id, fecha: t?.cerrado_at });
  }
}

console.log(`Líneas con producto: ${lineasValidas.length} · movimientos de salida: ${movimientos.length} · líneas sin receta (omitidas): ${omitidasSinReceta}`);
console.log(`\n${WRITE ? "APLICANDO" : "SIMULACIÓN (no escribe)"} — muestra de los 15 mayores consumos:\n`);
const top = [...movimientos].sort((a, b) => b.consumo - a.consumo).slice(0, 15);
for (const m of top) console.log(`  −${eur(m.consumo)}  ${m.nombre.padEnd(28)}  ${eur(m.antes)} → ${eur(m.despues)}   factura ${m.factura}`);

if (!WRITE) { console.log(`\n(Simulación: nada cambiado. Añade --write para aplicar de verdad.)\n`); process.exit(0); }

// ─── Escribir ────────────────────────────────────────────────────────────────
console.log(`\nEscribiendo ${movimientos.length} movimientos en el kardex y actualizando stock…`);
let escritos = 0;
for (const m of movimientos) {
  let st = stockByProd.get(m.productoId);
  let stockId = st?.id;
  if (!stockId) {
    const ins = await sb.from("stock").insert({ empresa_id: empresaId, producto_id: m.productoId, producto_nombre: m.nombre, cantidad_actual: 0, unidad: st?.unidad ?? "ud", ultimo_movimiento: m.fecha }).select("id").single();
    stockId = ins.data?.id; if (st) st.id = stockId;
  }
  await sb.from("stock_movimientos").insert({
    empresa_id: empresaId, producto_id: m.productoId, fecha: m.fecha, tipo: "salida",
    cantidad: m.consumo, signo: -1, saldo_resultante: m.despues, referencia: m.factura,
    documento_tipo: "pos_ticket", documento_id: ticketById.get([...ticketById.keys()].find(() => false)) ?? null,
    origen_linea_id: m.lineaId, motivo: `Venta`,
  });
  escritos++;
}
console.log("Aplicando saldos finales a stock…");
for (const [productoId, st] of stockByProd) {
  if (st.id && movimientos.some((m) => m.productoId === productoId)) {
    await sb.from("stock").update({ cantidad_actual: st.saldo, ultimo_movimiento: dia + "T12:00:00" }).eq("id", st.id);
  }
}
await sb.from("pos_tickets").update({ stock_descontado: true }).in("id", ticketIds);
console.log(`✓ Hecho: ${escritos} movimientos. Para deshacer: añade --revert.\n`);
